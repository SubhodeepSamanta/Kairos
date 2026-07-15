import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function launchKairosConsole() {
  const scriptPath = path.join(__dirname, "index.js");

  spawn("cmd.exe", ["/c", "start", "powershell.exe", "-Command", `node "${scriptPath}"`], {
    detached: true,
    stdio: "ignore"
  }).unref();
}
