import path from "path";
import { hasDatabase, connectMemoryDb, loadAllFromDb, upsertFact, deleteFact, isDbActive, memoryPool } from "./db.js";
import { readJson, writeJsonAtomic } from "../utils/jsonFile.js";
import { enqueueDbWrite, flushDbWrites } from "./syncQueue.js";

const MAX_ENTRIES = 300;
const MAX_PROMPT_ENTRIES = 40;

const dataDir = () => path.join(process.cwd(), "data");
const memoryFile = () => path.join(dataDir(), "memory.json");

let cache = null;
let useDb = false;

function loadFile() {
  return readJson(memoryFile(), {});
}

function load() {
  if (cache) return cache;
  cache = loadFile();
  return cache;
}

function persistFile() {
  writeJsonAtomic(memoryFile(), cache);
}

const DB_RETRY_MS = 60000;
let retryTimer = null;

async function connectAndLoad() {
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
}

function scheduleDbRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    try {
      await connectAndLoad();
      console.log(`[MEMORY] Postgres came back — ${Object.keys(cache).length} facts, syncing queued writes`);
      await flushDbWrites(memoryPool()).catch(() => {});
    } catch (err) {
      console.log(`[MEMORY] Postgres still unreachable (${err.message.slice(0, 60)}) — retrying in ${DB_RETRY_MS / 1000}s`);
      scheduleDbRetry();
    }
  }, DB_RETRY_MS);
  retryTimer.unref?.();
}

export async function initMemory() {
  if (!hasDatabase()) {
    cache = loadFile();
    console.log(`[MEMORY] Using local file (no DATABASE_URL), ${Object.keys(cache).length} facts`);
    return { backend: "file", facts: Object.keys(cache).length };
  }

  try {
    await connectAndLoad();
    console.log(`[MEMORY] Using Postgres, ${Object.keys(cache).length} facts loaded`);
    return { backend: "postgres", facts: Object.keys(cache).length };
  } catch (err) {
    cache = loadFile();
    useDb = false;
    console.log(`[MEMORY] Postgres unavailable (${err.message.slice(0, 80)}) — using the local file and retrying every ${DB_RETRY_MS / 1000}s`);
    scheduleDbRetry();
    return { backend: "file", facts: Object.keys(cache).length };
  }
}

const UPSERT_SQL = `INSERT INTO kairos_facts (memory_key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (memory_key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;

function persist(key) {
  persistFile();
  if (useDb && isDbActive() && key) {
    const value = cache[key].value;
    flushDbWrites(memoryPool())
      .then(() => upsertFact(key, value))
      .catch(err => {
        enqueueDbWrite(UPSERT_SQL, [key, value], `fact ${key}`);
        console.log(`[MEMORY] DB write for ${key} queued for retry: ${err.message.slice(0, 80)}`);
      });
  }
}

export function rememberFact(key, value) {
  if (!key || value === undefined || value === null) return false;
  const store = load();
  const normalKey = String(key).toLowerCase().replace(/\s+/g, "_").slice(0, 80);
  store[normalKey] = { value: String(value).slice(0, 500), updatedAt: new Date().toISOString() };

  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    const dropped = keys
      .sort((a, b) => new Date(store[a].updatedAt) - new Date(store[b].updatedAt))
      .slice(0, keys.length - MAX_ENTRIES);
    dropped.forEach(k => delete store[k]);
    if (useDb && isDbActive()) {
      for (const k of dropped) deleteFact(k).catch(() => {});
    }
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

const RECENT_BOOST_DAYS = 7;

function escapeRegex(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function relevantFacts(goalText) {
  const store = load();
  const entries = Object.entries(store);
  if (entries.length <= MAX_PROMPT_ENTRIES) {
    return Object.fromEntries(entries.map(([k, v]) => [k, v.value]));
  }

  const words = [...new Set(
    String(goalText || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 2)
  )];
  const now = Date.now();

  const scored = entries.map(([k, v]) => {
    const key = k.toLowerCase();
    const value = String(v.value).toLowerCase();
    let score = 0;
    for (const w of words) {
      const atStart = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(w)}`);
      if (atStart.test(key)) score += 2;
      else if (key.includes(w)) score += 1;
      if (atStart.test(value)) score += 1;
      else if (value.includes(w)) score += 0.5;
    }
    const ageDays = (now - new Date(v.updatedAt).getTime()) / 86400000;
    if (score > 0 && ageDays <= RECENT_BOOST_DAYS) score += 0.5;
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
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}
