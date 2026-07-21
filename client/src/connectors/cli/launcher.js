import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function launchKairosConsole({ voice = false } = {}) {
  const scriptPath = path.join(__dirname, "index.js");
  const prefix = voice ? "$env:VOICE='1'; " : "";

  spawn("cmd.exe", ["/c", "start", "powershell.exe", "-Command", `${prefix}node "${scriptPath}"`], {
    detached: true,
    stdio: "ignore"
  }).unref();
}
