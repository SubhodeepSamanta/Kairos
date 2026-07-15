import fs from "fs";
import path from "path";

const MAX_ENTRIES = 300;
const MAX_PROMPT_ENTRIES = 40;

const dataDir = () => path.join(process.cwd(), "data");
const memoryFile = () => path.join(dataDir(), "memory.json");

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(memoryFile(), "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(memoryFile(), JSON.stringify(cache, null, 2), "utf8");
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
  persist();
  console.log(`[MEMORY] Saved: ${normalKey} = ${store[normalKey].value.slice(0, 60)}`);
  return true;
}

export function forgetFact(key) {
  const store = load();
  const normalKey = String(key).toLowerCase().replace(/\s+/g, "_");
  if (store[normalKey]) {
    delete store[normalKey];
    persist();
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
}
