import fs from "fs";
import path from "path";

const LOCAL = process.env.LOCALAPPDATA || path.join(process.env.HOME || "", "AppData", "Local");
const PROGRAM_FILES = process.env.ProgramFiles || "C:\\Program Files";
const PROGRAM_FILES_X86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

const BROWSERS = {
  chrome: {
    label: "Chrome",
    channel: "chrome",
    userDataDir: path.join(LOCAL, "Google", "Chrome", "User Data"),
    executables: [
      path.join(PROGRAM_FILES, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(PROGRAM_FILES_X86, "Google", "Chrome", "Application", "chrome.exe")
    ]
  },
  brave: {
    label: "Brave",
    channel: null,
    userDataDir: path.join(LOCAL, "BraveSoftware", "Brave-Browser", "User Data"),
    executables: [
      path.join(PROGRAM_FILES, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      path.join(PROGRAM_FILES_X86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
    ]
  },
  edge: {
    label: "Edge",
    channel: "msedge",
    userDataDir: path.join(LOCAL, "Microsoft", "Edge", "User Data"),
    executables: [
      path.join(PROGRAM_FILES_X86, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(PROGRAM_FILES, "Microsoft", "Edge", "Application", "msedge.exe")
    ]
  }
};

export function isBrowserInstalled(name) {
  const spec = BROWSERS[name];
  if (!spec) return false;
  return spec.executables.some(exe => fs.existsSync(exe));
}

export function browserExecutable(name) {
  const spec = BROWSERS[name];
  if (!spec) return null;
  return spec.executables.find(exe => fs.existsSync(exe)) || null;
}

export function browserSpec(name) {
  return BROWSERS[name] || null;
}

export function installedBrowsers() {
  return Object.keys(BROWSERS).filter(isBrowserInstalled);
}

export function listProfiles(browserName) {
  const spec = BROWSERS[browserName];
  if (!spec) return [];

  const statePath = path.join(spec.userDataDir, "Local State");
  let cache = {};
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    cache = state.profile?.info_cache || {};
  } catch {
    return [];
  }

  const profiles = [];
  for (const [dir, info] of Object.entries(cache)) {
    if (!fs.existsSync(path.join(spec.userDataDir, dir))) continue;
    profiles.push({
      directory: dir,
      name: info.name || dir,
      account: info.user_name || null
    });
  }

  return profiles.sort((a, b) => {
    if (a.directory === "Default") return -1;
    if (b.directory === "Default") return 1;
    const na = Number(a.directory.replace(/\D/g, "")) || 0;
    const nb = Number(b.directory.replace(/\D/g, "")) || 0;
    return na - nb;
  });
}

export function resolveProfile(browserName, wanted) {
  const profiles = listProfiles(browserName);
  if (!profiles.length) return null;
  if (!wanted) return profiles[0];

  const query = String(wanted).trim().toLowerCase();

  const ordinals = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 };
  if (query in ordinals) return profiles[ordinals[query]] || null;

  const numberMatch = query.match(/^(?:profile\s*)?(\d+)$/);
  if (numberMatch) {
    const asDir = profiles.find(p => p.directory.toLowerCase() === `profile ${numberMatch[1]}`);
    if (asDir) return asDir;
    return profiles[Number(numberMatch[1])] || null;
  }

  return (
    profiles.find(p => p.directory.toLowerCase() === query) ||
    profiles.find(p => p.name.toLowerCase() === query) ||
    profiles.find(p => (p.account || "").toLowerCase() === query) ||
    profiles.find(p => p.name.toLowerCase().includes(query)) ||
    profiles.find(p => (p.account || "").toLowerCase().includes(query)) ||
    null
  );
}

export function describeBrowsers() {
  const lines = [];
  for (const name of installedBrowsers()) {
    const profiles = listProfiles(name);
    const rendered = profiles.length
      ? profiles.map(p => `"${p.name}"${p.account ? ` (${p.account})` : ""} [${p.directory}]`).join(", ")
      : "no profiles found";
    lines.push(`${BROWSERS[name].label} → ${rendered}`);
  }
  lines.push('playwright → isolated throwaway browser, no logins (default)');
  return lines.join("\n");
}
