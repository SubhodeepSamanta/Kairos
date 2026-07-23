import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { consoleAlreadyOpen } from "./lock.js";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SPAWN_SETTLE_MS = 5000;
let lastSpawnAt = 0;

export function launchConsole({ voice = false, spawner = spawn, root = clientRoot, platform = process.platform, now = Date.now } = {}) {
  if (now() - lastSpawnAt < SPAWN_SETTLE_MS) return { opened: false, reason: "already-open" };
  if (consoleAlreadyOpen(path.join(root, "data"))) return { opened: false, reason: "already-open" };
  if (platform !== "win32") return { opened: false, reason: "no-window" };

  const script = path.join(root, "src", "connectors", "cli", "index.js");
  const child = spawner("cmd.exe", ["/c", "start", "Kairos console", "node", script], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: voice ? { ...process.env, VOICE: "1" } : { ...process.env }
  });
  child.unref?.();
  lastSpawnAt = now();
  return { opened: true };
}
