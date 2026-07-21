import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const startedAt = Date.now();
let clientConnected = false;
let clientSince = null;
let queueDepth = 0;
let connectors = new Set();
let revision = null;

export function markClientConnected(on) {
  if (on && !clientConnected) clientSince = Date.now();
  if (!on) clientSince = null;
  clientConnected = Boolean(on);
}

export function markConnector(name, on) {
  if (on) connectors.add(name);
  else connectors.delete(name);
}

export function markQueueDepth(n) {
  queueDepth = Number(n) || 0;
}

function findGitDir() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, ".git");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readRevision() {
  if (revision !== null) return revision;
  revision = "";
  try {
    const gitDir = findGitDir();
    if (!gitDir) return revision;
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    const ref = head.startsWith("ref: ") ? head.slice(5) : null;
    const sha = ref ? fs.readFileSync(path.join(gitDir, ref), "utf8").trim() : head;
    revision = sha.slice(0, 7);
  } catch {}
  return revision;
}

export function formatDuration(ms) {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function runtimeStatus() {
  return {
    upMs: Date.now() - startedAt,
    startedAt,
    revision: readRevision(),
    clientConnected,
    clientForMs: clientSince ? Date.now() - clientSince : null,
    connectors: [...connectors],
    queueDepth
  };
}
