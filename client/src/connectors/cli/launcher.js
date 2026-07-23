import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { consoleAlreadyOpen } from "./lock.js";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function launchConsole({ voice = false, spawner = spawn, root = clientRoot, platform = process.platform } = {}) {
  if (consoleAlreadyOpen(path.join(root, "data"))) return { opened: false, reason: "already-open" };
  if (platform !== "win32") return { opened: false, reason: "no-window" };

  const script = path.join(root, "src", "connectors", "cli", "index.js");
  const child = spawner("cmd.exe", ["/c", "start", "Kairos console", "node", script], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: voice ? { ...process.env, VOICE: "1" } : { ...process.env }
  });
  child.unref?.();
  return { opened: true };
}
