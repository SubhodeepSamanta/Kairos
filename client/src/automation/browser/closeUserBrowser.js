import { execFile } from "child_process";
import { browserSpec } from "./profiles.js";

const EXE_NAMES = { chrome: "chrome.exe", brave: "brave.exe", edge: "msedge.exe" };
const GRACEFUL_WAIT_MS = Number(process.env.KAIROS_CLOSE_WAIT_MS) || 8000;
const FORCE_WAIT_MS = Number(process.env.KAIROS_CLOSE_WAIT_MS) || 5000;
const POLL_MS = 500;

function run(cmd, args) {
  return new Promise(resolve => {
    execFile(cmd, args, { windowsHide: true, timeout: 20000 }, (err, stdout) =>
      resolve({ err, stdout: String(stdout || "") })
    );
  });
}

async function isRunning(exe) {
  const { stdout } = await run("tasklist", ["/FI", `IMAGENAME eq ${exe}`, "/NH"]);
  return stdout.toLowerCase().includes(exe.toLowerCase());
}

async function waitForExit(exe, totalMs) {
  const deadline = Date.now() + totalMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS));
    if (!(await isRunning(exe))) return true;
  }
  return false;
}

export async function closeUserBrowser(browserName) {
  if (process.platform !== "win32") return { success: false, reason: "only supported on Windows" };
  const exe = EXE_NAMES[browserName];
  const label = browserSpec(browserName)?.label || browserName;
  if (!exe) return { success: false, reason: `unknown browser "${browserName}"` };

  if (!(await isRunning(exe))) return { success: true, closed: false, label };

  await run("taskkill", ["/IM", exe]);
  if (await waitForExit(exe, GRACEFUL_WAIT_MS)) {
    console.log(`[BROWSER] Closed the user's ${label} gracefully`);
    return { success: true, closed: true, label };
  }

  await run("taskkill", ["/F", "/IM", exe]);
  if (await waitForExit(exe, FORCE_WAIT_MS)) {
    console.log(`[BROWSER] Closed the user's ${label} (forced — it will offer to restore tabs)`);
    return { success: true, closed: true, forced: true, label };
  }

  return { success: false, reason: `${label} did not close — something is keeping it open` };
}
