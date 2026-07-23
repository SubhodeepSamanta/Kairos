import fs from "fs";
import path from "path";

const defaultDir = () => path.join(process.cwd(), "data");
const lockFile = (dir) => path.join(dir, "console.lock");

function readPid(dir) {
  try {
    const pid = Number(fs.readFileSync(lockFile(dir), "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

export function consoleAlreadyOpen(dir = defaultDir()) {
  const pid = readPid(dir);
  return pid !== null && pid !== process.pid && isAlive(pid);
}

export function claimConsole(dir = defaultDir()) {
  if (consoleAlreadyOpen(dir)) return false;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(lockFile(dir), String(process.pid), "utf8");
  } catch {}
  return true;
}

export function releaseConsole(dir = defaultDir()) {
  try {
    if (readPid(dir) === process.pid) fs.unlinkSync(lockFile(dir));
  } catch {}
}
