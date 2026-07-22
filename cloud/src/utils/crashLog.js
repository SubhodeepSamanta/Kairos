import fs from "fs";
import path from "path";

const KEEP_CHARS = 200000;

export function formatCrash(kind, reason) {
  const detail = reason instanceof Error
    ? `${reason.message}\n${reason.stack || ""}`
    : String(reason);
  return `[${new Date().toISOString()}] ${kind}\n${detail}\n\n`;
}

export function appendCrash(kind, reason, file = path.join(process.cwd(), "data", "crash.log")) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let existing = "";
    try { existing = fs.readFileSync(file, "utf8"); } catch {}
    fs.writeFileSync(file, (existing + formatCrash(kind, reason)).slice(-KEEP_CHARS), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function installCrashHandlers({ file, exit = process.exit } = {}) {
  process.on("uncaughtException", (err) => {
    console.error(`[CRASH] uncaught exception — details saved to data/crash.log\n${err?.stack || err}`);
    appendCrash("uncaughtException", err, file);
    exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error(`[CRASH] unhandled rejection — kept running, details saved to data/crash.log\n${reason?.stack || reason}`);
    appendCrash("unhandledRejection", reason, file);
  });
}
