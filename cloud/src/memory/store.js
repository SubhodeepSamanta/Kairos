import fs from "fs";
import path from "path";
import { hasDatabase, connectMemoryDb, loadAllFromDb, upsertFact, deleteFact, isDbActive } from "./db.js";

const MAX_ENTRIES = 300;
const MAX_PROMPT_ENTRIES = 40;

const dataDir = () => path.join(process.cwd(), "data");
const memoryFile = () => path.join(dataDir(), "memory.json");

let cache = null;
let useDb = false;

function loadFile() {
  try {
    return JSON.parse(fs.readFileSync(memoryFile(), "utf8"));
  } catch {
    return {};
  }
}

function load() {
  if (cache) return cache;
  cache = loadFile();
  return cache;
}

function persistFile() {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(memoryFile(), JSON.stringify(cache, null, 2), "utf8");
}

export async function initMemory() {
  if (!hasDatabase()) {
    cache = loadFile();
    console.log(`[MEMORY] Using local file (no DATABASE_URL), ${Object.keys(cache).length} facts`);
    return { backend: "file", facts: Object.keys(cache).length };
  }

  try {
    await connectMemoryDb();
    const fromDb = await loadAllFromDb();
    const fromFile = loadFile();

    for (const [key, entry] of Object.entries(fromFile)) {
      const existing = fromDb[key];
      if (!existing || new Date(entry.updatedAt) > new Date(existing.updatedAt)) {
        fromDb[key] = entry;
        await upsertFact(key, entry.value).catch(() => {});
      }
    }

    cache = fromDb;
    useDb = true;
    persistFile();
    console.log(`[MEMORY] Using Postgres, ${Object.keys(cache).length} facts loaded`);
    return { backend: "postgres", facts: Object.keys(cache).length };
  } catch (err) {
    cache = loadFile();
    useDb = false;
    console.log(`[MEMORY] Postgres unavailable (${err.message.slice(0, 80)}), falling back to local file`);
    return { backend: "file", facts: Object.keys(cache).length };
  }
}

function persist(key) {
  persistFile();
  if (useDb && isDbActive() && key) {
    upsertFact(key, cache[key].value).catch(err =>
      console.log(`[MEMORY] DB write failed for ${key}: ${err.message.slice(0, 80)}`)
    );
  }
}

export function rememberFact(key, value) {
  if (!key || value === undefined || value === null) return false;
  const store = load();
  const normalKey = String(key).toLowerCase().replace(/\s+/g, "_").slice(0, 80);
  store[normalKey] = { value: String(value).slice(0, 500), updatedAt: new Date().toISOString() };

  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => new Date(store[a].updatedAt) - new Date(store[b].updatedAt))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach(k => delete store[k]);
  }
  persist(normalKey);
  console.log(`[MEMORY] Saved: ${normalKey} = ${store[normalKey].value.slice(0, 60)}`);
  return true;
}

export function memoryBackend() {
  return useDb && isDbActive() ? "postgres" : "file";
}

export function forgetFact(key) {
  const store = load();
  const normalKey = String(key).toLowerCase().replace(/\s+/g, "_");
  if (store[normalKey]) {
    delete store[normalKey];
    persistFile();
    if (useDb && isDbActive()) {
      deleteFact(normalKey).catch(() => {});
    }
    return true;
  }
  return false;
}

export function getAllFacts() {
  const store = load();
  return Object.fromEntries(Object.entries(store).map(([k, v]) => [k, v.value]));
}

export function relevantFacts(goalText) {
  const store = load();
  const entries = Object.entries(store);
  if (entries.length <= MAX_PROMPT_ENTRIES) {
    return Object.fromEntries(entries.map(([k, v]) => [k, v.value]));
  }

  const words = String(goalText || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2);

  const scored = entries.map(([k, v]) => {
    const haystack = `${k} ${v.value}`.toLowerCase();
    const score = words.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0);
    return { k, v, score, updatedAt: v.updatedAt };
  });

  scored.sort((a, b) => b.score - a.score || new Date(b.updatedAt) - new Date(a.updatedAt));
  return Object.fromEntries(scored.slice(0, MAX_PROMPT_ENTRIES).map(({ k, v }) => [k, v.value]));
}

export function formatFactsForPrompt(facts) {
  const entries = Object.entries(facts || {});
  if (!entries.length) return "none yet";
  return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

export function resetMemoryCacheForTests() {
  cache = null;
  useDb = false;
}
