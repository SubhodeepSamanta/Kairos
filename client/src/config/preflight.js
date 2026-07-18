import fs from "fs";
import { chromium } from "playwright";
import { env as defaultEnv } from "./env.js";
import { installedBrowsers } from "../automation/browser/profiles.js";

function has(value) {
  return Boolean(value && String(value).trim());
}

export function bundledChromiumInstalled() {
  try {
    const path = chromium.executablePath();
    return Boolean(path && fs.existsSync(path));
  } catch {
    return false;
  }
}

export function clientPreflight(env = defaultEnv, deps = {}) {
  const browsers = (deps.installedBrowsers || installedBrowsers)();
  const chromiumReady = (deps.bundledChromiumInstalled || bundledChromiumInstalled)();

  const problems = [];
  const notes = [];

  notes.push(`Cloud: ${env.CLOUD_URL || "ws://localhost:3000 (default)"}`);
  notes.push(has(env.CLIENT_SECRET) ? "Auth: sending CLIENT_SECRET" : "Auth: no CLIENT_SECRET (must match a cloud with auth off)");

  if (browsers.length) {
    notes.push(`Real browsers: ${browsers.join(", ")}`);
  } else {
    notes.push("Real browsers: none found (Chrome/Brave/Edge) — will use bundled Chromium");
  }

  if (chromiumReady) {
    notes.push("Bundled Chromium: installed");
  } else if (!browsers.length) {
    problems.push(
      "No browser available at all — cannot drive the web.",
      "  Install Chrome/Brave/Edge, or run:  npx playwright install chromium"
    );
  } else {
    notes.push("Bundled Chromium: missing (run `npx playwright install chromium` for the isolated fallback)");
  }

  return { ok: problems.length === 0, problems, notes };
}

export function reportPreflight(report, label = "Kairos client") {
  console.log(`\n${label} — startup check`);
  for (const note of report.notes) console.log(`  ${report.ok ? "✓" : "•"} ${note}`);
  if (!report.ok) {
    console.log("\n  ✗ Problem:");
    for (const line of report.problems) console.log(`    ${line}`);
  }
  console.log("");
  return report.ok;
}
