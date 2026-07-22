import fs from "fs";
import path from "path";

const PLACEHOLDER_RE = /\{\{secret:([a-z0-9_\-]+)\}\}/gi;

const dataDir = () => path.join(process.cwd(), "data");
const vaultFile = () => path.join(dataDir(), "secrets.json");

let cache = null;

function keyFor(name) {
  return String(name).toLowerCase().replace(/\s+/g, "_");
}

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(vaultFile(), "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

export function storeSecret(name, value) {
  if (!name || !value) return false;
  const vault = load();
  vault[keyFor(name)] = String(value);
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = `${vaultFile()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(vault, null, 2), "utf8");
  fs.renameSync(tmp, vaultFile());
  console.log(`[VAULT] Stored secret "${name}" locally`);
  return true;
}

export function hasSecret(name) {
  return Boolean(load()[keyFor(name)]);
}

export function resolveSecrets(text) {
  const vault = load();
  const missing = [];
  const resolved = String(text ?? "").replace(PLACEHOLDER_RE, (match, name) => {
    const key = name.toLowerCase();
    if (vault[key] !== undefined) return vault[key];
    missing.push(key);
    return match;
  });
  return { resolved, missing, containedSecret: resolved !== String(text ?? "") };
}

export function resetVaultCacheForTests() {
  cache = null;
}
