import { spawn } from "child_process";
import readline from "readline";
import fs from "fs";
import os from "os";
import path from "path";
import { SERVER_SCRIPT } from "./uiaServer.js";

const DEFAULT_TIMEOUT_MS = 20000;

let proc = null;
let rl = null;
let starting = null;
let seq = 0;
const pending = new Map();

function scriptPath() {
  const dir = path.join(os.tmpdir(), "kairos-desktop");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "uia-host.ps1");
  fs.writeFileSync(file, SERVER_SCRIPT, "utf8");
  return file;
}

function rejectAll(reason) {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

function teardown(reason) {
  rejectAll(reason);
  if (rl) { rl.close(); rl = null; }
  if (proc) { proc.removeAllListeners(); try { proc.kill(); } catch {} proc = null; }
  starting = null;
}

async function ensureBridge() {
  if (proc && !proc.killed) return;
  if (starting) return starting;
  starting = new Promise((resolve, reject) => {
    try {
      const file = scriptPath();
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file], {
        windowsHide: true
      });
      child.on("error", (err) => { teardown(`desktop bridge failed to start: ${err.message}`); reject(err); });
      child.on("exit", (code) => teardown(`desktop bridge exited (${code})`));
      child.stderr.on("data", (d) => console.log(`[UIA] ${String(d).trim().slice(0, 200)}`));

      rl = readline.createInterface({ input: child.stdout });
      rl.on("line", (line) => {
        const text = line.trim();
        if (!text) return;
        let msg;
        try { msg = JSON.parse(text); } catch { return; }
        const waiter = pending.get(msg.id);
        if (!waiter) return;
        pending.delete(msg.id);
        clearTimeout(waiter.timer);
        if (msg.ok) waiter.resolve(msg.data ?? {});
        else waiter.reject(new Error(msg.error || "desktop command failed"));
      });

      proc = child;
      resolve();
    } catch (err) {
      teardown(`desktop bridge failed to start: ${err.message}`);
      reject(err);
    }
  });
  return starting;
}

export async function sendToBridge(request, timeoutMs = DEFAULT_TIMEOUT_MS) {
  await ensureBridge();
  if (!proc) throw new Error("desktop bridge is not available");
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`desktop command "${request.cmd}" timed out`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      proc.stdin.write(`${JSON.stringify({ id, ...request })}\n`);
    } catch (err) {
      pending.delete(id);
      clearTimeout(timer);
      reject(err);
    }
  });
}

export function stopBridge() {
  teardown("desktop bridge stopped");
}

export function bridgeRunning() {
  return Boolean(proc && !proc.killed);
}
