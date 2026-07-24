import { spawn, execFile } from "child_process";
import { getInstalledApps } from "../../../registry/apps.js";

const LAUNCH_TIMEOUT_MS = 15000;

let runPowerShell = defaultRunner;

function defaultRunner(script) {
  return new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: LAUNCH_TIMEOUT_MS, maxBuffer: 1 << 20 },
      (err, stdout, stderr) => resolve({ err, stdout: String(stdout || ""), stderr: String(stderr || "") })
    );
  });
}

export function setPowerShellRunnerForTests(fn) {
  runPowerShell = fn || defaultRunner;
}

export function pickApp(apps, query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return null;
  let starts = null;
  let includes = null;
  for (const app of apps || []) {
    const name = app?.Name?.toLowerCase().trim();
    if (!name) continue;
    if (name === q) return app;
    if (!starts && name.startsWith(q)) starts = app;
    if (!includes && name.includes(q)) includes = app;
  }
  return starts || includes || null;
}

export function buildFocusScript(term) {
  const t = psLiteral(term);
  return `$ErrorActionPreference='SilentlyContinue';
$term=${t};
$p=Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*$term*" -or $_.MainWindowTitle -like "*$term*") } | Sort-Object { $_.MainWindowTitle.Length } | Select-Object -First 1;
if (-not $p) { 'notfound'; exit }
$sig='[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n);';
$u=Add-Type -MemberDefinition $sig -Name Win -Namespace Native -PassThru;
$u::ShowWindowAsync($p.MainWindowHandle,9) | Out-Null;
$u::SetForegroundWindow($p.MainWindowHandle) | Out-Null;
$p.MainWindowTitle`;
}

export function buildCloseScript(term) {
  const t = psLiteral(term);
  return `$ErrorActionPreference='SilentlyContinue';
$term=${t};
$procs=Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*$term*" -or $_.MainWindowTitle -like "*$term*") };
if (-not $procs) { 'notfound'; exit }
$closed=0;
foreach ($p in $procs) { if ($p.CloseMainWindow()) { $closed++ } }
Start-Sleep -Milliseconds 600;
"closed:$closed"`;
}

function psLiteral(value) {
  return `'${String(value == null ? "" : value).replace(/'/g, "''")}'`;
}

export async function listApps() {
  const apps = await getInstalledApps();
  return apps.map(a => a?.Name).filter(Boolean);
}

export async function openApp(app) {
  const found = await findInstalledApp(app);
  if (found?.AppID) {
    spawn("explorer.exe", [`shell:AppsFolder\\${found.AppID}`], { detached: true, stdio: "ignore" }).unref();
    return { success: true, app: found.Name || app, launched: found.Name || app };
  }
  const target = String(app || "").trim();
  if (!target) return { success: false, app, reason: "no app name given" };
  spawn("cmd.exe", ["/c", "start", "", target], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  return { success: true, app: target, launched: target, note: "started by name — if nothing opened, list_apps and use the exact name" };
}

export async function focusApp(app) {
  const { err, stdout } = await runPowerShell(buildFocusScript(app));
  const out = stdout.trim();
  if (err) return { success: false, app, reason: `could not focus: ${err.message.slice(0, 80)}` };
  if (!out || out === "notfound") return { success: false, app, reason: `no open window matched "${app}" — open it first` };
  return { success: true, app, focused: out };
}

export async function closeApp(app) {
  const { err, stdout } = await runPowerShell(buildCloseScript(app));
  const out = stdout.trim();
  if (err) return { success: false, app, reason: `could not close: ${err.message.slice(0, 80)}` };
  if (out === "notfound") return { success: false, app, reason: `no open window matched "${app}"` };
  const closed = Number((out.match(/closed:(\d+)/) || [])[1] || 0);
  if (closed > 0) return { success: true, app, closed: true };
  return { success: false, app, reason: `matched a window but it did not close — it may be asking to save` };
}

async function findInstalledApp(app) {
  const apps = await getInstalledApps();
  return pickApp(apps, app);
}
