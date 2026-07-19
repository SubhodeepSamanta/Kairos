import { execFile } from "child_process";
import { automationDataDir } from "./profiles.js";

const BROWSER_EXES = ["chrome.exe", "msedge.exe", "brave.exe"];

export function releaseKairosLock(browserName) {
  return new Promise(resolve => {
    if (process.platform !== "win32") return resolve(false);
    const dir = automationDataDir(browserName).replace(/'/g, "''");
    const nameFilter = BROWSER_EXES.map(n => `Name='${n}'`).join(" OR ");
    const script = [
      `$stale = Get-CimInstance Win32_Process -Filter "${nameFilter}" | Where-Object { $_.CommandLine -like '*${dir}*' }`,
      `$stale | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      `Write-Output ($stale | Measure-Object).Count`
    ].join("; ");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 15000 },
      (err, stdout) => {
        if (err) return resolve(false);
        resolve(Number(String(stdout).trim()) > 0);
      }
    );
  });
}
