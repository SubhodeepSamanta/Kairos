import path from "path";
import { memoryPool, isDbActive } from "../memory/db.js";
import { DEFAULT_PERSONA } from "./personas.js";
import { readJson, writeJsonAtomic } from "../utils/jsonFile.js";
import { enqueueDbWrite, flushDbWrites } from "../memory/syncQueue.js";

export const IDENTITY = "default";

const KEEP_TURNS = 14;
const ARCHIVE_TURNS = 300;
const KEEP_EVENTS = 60;
const KEEP_MOODS = 80;

const dataDir = () => path.join(process.cwd(), "data");
const fileFor = (name) => path.join(dataDir(), `${name}.json`);

let lastStamp = 0;
function stampNow() {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return new Date(lastStamp).toISOString();
}

const cache = { turns: null, events: null, moods: null, prefs: null, digests: null };

function loadFile(name, fallback) {
  if (cache[name]) return cache[name];
  cache[name] = readJson(fileFor(name), fallback);
  return cache[name];
}

function saveFile(name) {
  writeJsonAtomic(fileFor(name), cache[name]);
}

function db() {
  return isDbActive() ? memoryPool() : null;
}

let dbChain = Promise.resolve();

function dbWrite(sql, params, label) {
  dbChain = dbChain.then(async () => {
    const pool = db();
    if (!pool) return;
    await flushDbWrites(pool);
    try {
      await pool.query(sql, params);
    } catch (err) {
      enqueueDbWrite(sql, params, label);
      console.log(`[COMPANION] ${label} write queued for retry: ${err.message.slice(0, 60)}`);
    }
  });
  return dbChain;
}

export function pendingDbChain() {
  return dbChain;
}

export function seedStoreIfEmpty(name, data) {
  const current = loadFile(name, {});
  if (Object.keys(current).length) return false;
  cache[name] = data;
  saveFile(name);
  return true;
}

function trimList(list, keep) {
  if (list.length <= keep) return 0;
  const drop = list.length - keep;
  list.splice(0, drop);
  return drop;
}

function turnsFor(chatId) {
  const turns = loadFile("turns", {});
  const raw = turns[chatId];
  if (!raw) return (turns[chatId] = { list: [], dropped: 0 });
  if (Array.isArray(raw)) return (turns[chatId] = { list: raw, dropped: 0 });
  return raw;
}

export async function addTurn(chatId, role, text) {
  const clean = String(text || "").slice(0, 2000);
  if (!clean) return;

  const entry = turnsFor(chatId);
  entry.list.push({ role, text: clean, at: stampNow() });
  entry.dropped += trimList(entry.list, ARCHIVE_TURNS);
  saveFile("turns");

  dbWrite("INSERT INTO kairos_turns (chat_id, role, text) VALUES ($1, $2, $3)", [chatId, role, clean], "turn");
}

export async function loadTurns(chatId) {
  return turnsFor(chatId).list.slice(-KEEP_TURNS);
}

export async function addEvent(chatId, summary, success, steps) {
  const events = loadFile("events", {});
  if (!events[chatId]) events[chatId] = [];
  events[chatId].push({ summary: String(summary).slice(0, 300), success, steps, at: stampNow() });
  trimList(events[chatId], KEEP_EVENTS);
  saveFile("events");

  dbWrite("INSERT INTO kairos_events (chat_id, summary, success, steps) VALUES ($1, $2, $3, $4)", [
    chatId, String(summary).slice(0, 300), success, steps
  ], "event");
}

export async function loadEvents(chatId, sinceDays = 4) {
  const cutoff = Date.now() - sinceDays * 86400000;
  return (loadFile("events", {})[chatId] || []).filter(e => new Date(e.at).getTime() > cutoff);
}

export async function addMood(chatId, label, confidence, why) {
  const moods = loadFile("moods", {});
  if (!moods[chatId]) moods[chatId] = [];
  moods[chatId].push({ label, confidence, why: String(why || "").slice(0, 160), at: stampNow() });
  trimList(moods[chatId], KEEP_MOODS);
  saveFile("moods");

  dbWrite("INSERT INTO kairos_moods (chat_id, label, confidence, why) VALUES ($1, $2, $3, $4)", [
    chatId, label, confidence, String(why || "").slice(0, 160)
  ], "mood");
}

export async function loadMoods(chatId, sinceDays = 7) {
  const cutoff = Date.now() - sinceDays * 86400000;
  return (loadFile("moods", {})[chatId] || []).filter(m => new Date(m.at).getTime() > cutoff);
}

export async function countTurns(chatId) {
  const entry = turnsFor(chatId);
  return entry.dropped + entry.list.length;
}

export async function archivedTurnCount(chatId) {
  return turnsFor(chatId).dropped;
}

export async function loadTurnsBefore(chatId, total) {
  const summary = await getSummary(chatId);
  const entry = turnsFor(chatId);
  const skip = Math.max(summary.coveredTurns, entry.dropped);
  const take = Math.max(0, total - skip - KEEP_TURNS);
  if (take <= 0) return [];

  return entry.list.slice(skip - entry.dropped, skip - entry.dropped + take);
}

export async function getSummary(chatId) {
  const prefs = loadFile("prefs", {})[chatId] || {};
  return { text: prefs.summary || "", coveredTurns: prefs.coveredTurns || 0 };
}

export async function setSummary(chatId, text, coveredTurns) {
  await setPrefs(chatId, { summary: text, coveredTurns });
}

export async function getPrefs(chatId) {
  const prefs = loadFile("prefs", {});
  const p = prefs[chatId] || {};
  return { persona: p.persona || DEFAULT_PERSONA, moodTracking: p.moodTracking !== false };
}

export async function setPrefs(chatId, patch) {
  const prefs = loadFile("prefs", {});
  prefs[chatId] = { ...(prefs[chatId] || {}), ...patch };
  saveFile("prefs");

  const current = prefs[chatId];
  dbWrite(
    `INSERT INTO kairos_prefs (chat_id, persona, mood_tracking, summary, covered_turns, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (chat_id) DO UPDATE SET persona = EXCLUDED.persona, mood_tracking = EXCLUDED.mood_tracking,
       summary = EXCLUDED.summary, covered_turns = EXCLUDED.covered_turns, updated_at = NOW()`,
    [chatId, current.persona || DEFAULT_PERSONA, current.moodTracking !== false, current.summary || null, current.coveredTurns || 0],
    "prefs"
  );
  return prefs[chatId];
}

export async function getDigest(chatId, day) {
  return loadFile("digests", {})[chatId]?.[day] || null;
}

export async function setDigest(chatId, day, line) {
  const digests = loadFile("digests", {});
  if (!digests[chatId]) digests[chatId] = {};
  digests[chatId][day] = String(line).slice(0, 300);
  const days = Object.keys(digests[chatId]).sort();
  for (const old of days.slice(0, Math.max(0, days.length - 30))) delete digests[chatId][old];
  saveFile("digests");

  dbWrite(
    `INSERT INTO kairos_digests (chat_id, day, line) VALUES ($1, $2, $3)
     ON CONFLICT (chat_id, day) DO UPDATE SET line = EXCLUDED.line`,
    [chatId, day, String(line).slice(0, 300)],
    "digest"
  );
}

export async function forgetChat(chatId, what) {
  const pool = db();
  const tables = { turns: "kairos_turns", events: "kairos_events", moods: "kairos_moods", digests: "kairos_digests" };
  const targets = what === "all" ? Object.keys(tables) : what === "events" ? ["events", "digests"] : [what];

  for (const t of targets) {
    if (!tables[t]) continue;
    const store = loadFile(t, {});
    delete store[chatId];
    saveFile(t);
    if (pool) {
      try { await pool.query(`DELETE FROM ${tables[t]} WHERE chat_id = $1`, [chatId]); } catch {}
    }
  }
  return targets;
}

export async function unifyIdentity() {
  const allNames = ["turns", "events", "moods", "digests", "prefs"];
  const strayIds = new Set(allNames.flatMap(name => Object.keys(loadFile(name, {}))));
  strayIds.delete(IDENTITY);

  if (strayIds.size) {
    const turns = loadFile("turns", {});
    const counts = {};
    for (const id of [IDENTITY, ...strayIds]) {
      counts[id] = turns[id] ? (await countTurns(id)) : 0;
    }
    const primary = [IDENTITY, ...strayIds].sort((a, b) => counts[b] - counts[a])[0];

    const merged = { list: [], dropped: 0 };
    for (const id of Object.keys(turns)) {
      const entry = turnsFor(id);
      merged.list.push(...entry.list);
      merged.dropped += entry.dropped;
    }
    merged.list.sort((a, b) => new Date(a.at) - new Date(b.at));
    merged.dropped += trimList(merged.list, ARCHIVE_TURNS);
    cache.turns = { [IDENTITY]: merged };
    saveFile("turns");

    for (const [name, keep] of [["events", KEEP_EVENTS], ["moods", KEEP_MOODS]]) {
      const store = loadFile(name, {});
      const all = Object.values(store).flat().sort((a, b) => new Date(a.at) - new Date(b.at));
      trimList(all, keep);
      cache[name] = { [IDENTITY]: all };
      saveFile(name);
    }

    const digests = loadFile("digests", {});
    const mergedDays = {};
    for (const id of Object.keys(digests)) {
      if (id !== IDENTITY) Object.assign(mergedDays, digests[id]);
    }
    Object.assign(mergedDays, digests[IDENTITY] || {});
    cache.digests = { [IDENTITY]: mergedDays };
    saveFile("digests");

    const prefs = loadFile("prefs", {});
    cache.prefs = { [IDENTITY]: prefs[primary] || prefs[IDENTITY] || {} };
    saveFile("prefs");

    console.log(`[COMPANION] merged ${strayIds.size} chat identit${strayIds.size === 1 ? "y" : "ies"} into "${IDENTITY}"`);
  }

  const pool = db();
  if (!pool) return;
  try {
    for (const table of ["kairos_turns", "kairos_events", "kairos_moods"]) {
      await pool.query(`UPDATE ${table} SET chat_id = $1 WHERE chat_id <> $1`, [IDENTITY]);
    }
    await pool.query(
      `INSERT INTO kairos_digests (chat_id, day, line)
       SELECT $1, day, line FROM kairos_digests WHERE chat_id <> $1
       ON CONFLICT (chat_id, day) DO NOTHING`,
      [IDENTITY]
    );
    await pool.query(`DELETE FROM kairos_digests WHERE chat_id <> $1`, [IDENTITY]);
    const current = loadFile("prefs", {})[IDENTITY];
    if (current && Object.keys(current).length) await setPrefs(IDENTITY, current);
    await pool.query(`DELETE FROM kairos_prefs WHERE chat_id <> $1`, [IDENTITY]);
  } catch (err) {
    console.log(`[COMPANION] identity merge in Postgres skipped: ${err.message.slice(0, 80)}`);
  }
}

export function resetCompanionCacheForTests() {
  cache.turns = null;
  cache.events = null;
  cache.moods = null;
  cache.prefs = null;
  cache.digests = null;
}
