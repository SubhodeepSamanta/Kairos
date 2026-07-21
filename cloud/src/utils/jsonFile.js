import fs from "fs";
import path from "path";

const STALE_TEMP_MS = 5 * 60 * 1000;

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

export function sweepStaleTemps(dir, maxAgeMs = STALE_TEMP_MS) {
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of entries) {
    if (!name.endsWith(".tmp")) continue;
    const full = path.join(dir, name);
    try {
      if (Date.now() - fs.statSync(full).mtimeMs < maxAgeMs) continue;
      fs.unlinkSync(full);
      removed++;
    } catch {}
  }
  return removed;
}
