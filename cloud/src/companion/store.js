import path from "path";
import { memoryPool, isDbActive } from "../memory/db.js";
import { DEFAULT_PERSONA } from "./personas.js";
import { readJson, writeJsonAtomic } from "../utils/jsonFile.js";
import { enqueueDbWrite, flushDbWrites } from "../memory/syncQueue.js";

const KEEP_TURNS = 14;
const ARCHIVE_TURNS = 300;
const KEEP_EVENTS = 60;
const KEEP_MOODS = 80;

const dataDir = () => path.join(process.cwd(), "data");
const fileFor = (name) => path.join(dataDir(), `${name}.json`);

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

async function dbWrite(sql, params, label) {
  const pool = db();
  if (!pool) return;
  await flushDbWrites(pool);
  try {
    await pool.query(sql, params);
  } catch (err) {
    enqueueDbWrite(sql, params, label);
    console.log(`[COMPANION] ${label} write queued for retry: ${err.message.slice(0, 60)}`);
  }
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
  entry.list.push({ role, text: clean, at: new Date().toISOString() });
  entry.dropped += trimList(entry.list, ARCHIVE_TURNS);
  saveFile("turns");

  await dbWrite("INSERT INTO kairos_turns (chat_id, role, text) VALUES ($1, $2, $3)", [chatId, role, clean], "turn");
}

export async function loadTurns(chatId) {
  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT role, text, said_at FROM kairos_turns WHERE chat_id = $1 ORDER BY said_at DESC LIMIT $2",
        [chatId, KEEP_TURNS]
      );
      return rows.reverse().map(r => ({ role: r.role, text: r.text, at: r.said_at }));
    } catch {}
  }
  return turnsFor(chatId).list.slice(-KEEP_TURNS);
}

export async function addEvent(chatId, summary, success, steps) {
  const events = loadFile("events", {});
  if (!events[chatId]) events[chatId] = [];
  events[chatId].push({ summary: String(summary).slice(0, 300), success, steps, at: new Date().toISOString() });
  trimList(events[chatId], KEEP_EVENTS);
  saveFile("events");

  await dbWrite("INSERT INTO kairos_events (chat_id, summary, success, steps) VALUES ($1, $2, $3, $4)", [
    chatId, String(summary).slice(0, 300), success, steps
  ], "event");
}

export async function loadEvents(chatId, sinceDays = 4) {
  const cutoff = Date.now() - sinceDays * 86400000;
  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT summary, success, happened_at FROM kairos_events WHERE chat_id = $1 AND happened_at > NOW() - ($2 || ' days')::INTERVAL ORDER BY happened_at DESC LIMIT 40",
        [chatId, String(sinceDays)]
      );
      return rows.reverse().map(r => ({ summary: r.summary, success: r.success, at: r.happened_at }));
    } catch {}
  }
  return (loadFile("events", {})[chatId] || []).filter(e => new Date(e.at).getTime() > cutoff);
}

export async function addMood(chatId, label, confidence, why) {
  const moods = loadFile("moods", {});
  if (!moods[chatId]) moods[chatId] = [];
  moods[chatId].push({ label, confidence, why: String(why || "").slice(0, 160), at: new Date().toISOString() });
  trimList(moods[chatId], KEEP_MOODS);
  saveFile("moods");

  await dbWrite("INSERT INTO kairos_moods (chat_id, label, confidence, why) VALUES ($1, $2, $3, $4)", [
    chatId, label, confidence, String(why || "").slice(0, 160)
  ], "mood");
}

export async function loadMoods(chatId, sinceDays = 7) {
  const cutoff = Date.now() - sinceDays * 86400000;
  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT label, confidence, why, noted_at FROM kairos_moods WHERE chat_id = $1 AND noted_at > NOW() - ($2 || ' days')::INTERVAL ORDER BY noted_at DESC LIMIT 40",
        [chatId, String(sinceDays)]
      );
      return rows.reverse().map(r => ({ label: r.label, confidence: r.confidence, why: r.why, at: r.noted_at }));
    } catch {}
  }
  return (loadFile("moods", {})[chatId] || []).filter(m => new Date(m.at).getTime() > cutoff);
}

export async function countTurns(chatId) {
  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT COUNT(*)::INT AS n FROM kairos_turns WHERE chat_id = $1", [chatId]);
      return rows[0]?.n || 0;
    } catch {}
  }
  const entry = turnsFor(chatId);
  return entry.dropped + entry.list.length;
}

export async function loadTurnsBefore(chatId, total) {
  const summary = await getSummary(chatId);
  const skip = summary.coveredTurns;
  const take = Math.max(0, total - skip - KEEP_TURNS);
  if (take <= 0) return [];

  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT role, text FROM kairos_turns WHERE chat_id = $1 ORDER BY said_at ASC OFFSET $2 LIMIT $3",
        [chatId, skip, take]
      );
      return rows.map(r => ({ role: r.role, text: r.text }));
    } catch {}
  }
  const entry = turnsFor(chatId);
  const start = Math.max(0, skip - entry.dropped);
  return entry.list.slice(start, start + take);
}

export async function getSummary(chatId) {
  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT summary, covered_turns FROM kairos_prefs WHERE chat_id = $1", [chatId]);
      if (rows[0]) return { text: rows[0].summary || "", coveredTurns: rows[0].covered_turns || 0 };
    } catch {}
  }
  const prefs = loadFile("prefs", {})[chatId] || {};
  return { text: prefs.summary || "", coveredTurns: prefs.coveredTurns || 0 };
}

export async function setSummary(chatId, text, coveredTurns) {
  await setPrefs(chatId, { summary: text, coveredTurns });
}

export async function getPrefs(chatId) {
  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT persona, mood_tracking FROM kairos_prefs WHERE chat_id = $1", [chatId]);
      if (rows[0]) return { persona: rows[0].persona || DEFAULT_PERSONA, moodTracking: rows[0].mood_tracking !== false };
    } catch {}
  }
  const prefs = loadFile("prefs", {});
  const p = prefs[chatId] || {};
  return { persona: p.persona || DEFAULT_PERSONA, moodTracking: p.moodTracking !== false };
}

export async function setPrefs(chatId, patch) {
  const pool = db();
  const prefs = loadFile("prefs", {});

  let base = prefs[chatId] || {};
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT persona, mood_tracking, summary, covered_turns FROM kairos_prefs WHERE chat_id = $1",
        [chatId]
      );
      if (rows[0]) {
        base = {
          persona: rows[0].persona || base.persona,
          moodTracking: rows[0].mood_tracking !== false,
          summary: rows[0].summary || base.summary,
          coveredTurns: rows[0].covered_turns || base.coveredTurns || 0
        };
      }
    } catch {}
  }

  prefs[chatId] = { ...base, ...patch };
  saveFile("prefs");

  if (pool) {
    const current = prefs[chatId];
    await dbWrite(
      `INSERT INTO kairos_prefs (chat_id, persona, mood_tracking, summary, covered_turns, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (chat_id) DO UPDATE SET persona = EXCLUDED.persona, mood_tracking = EXCLUDED.mood_tracking,
         summary = EXCLUDED.summary, covered_turns = EXCLUDED.covered_turns, updated_at = NOW()`,
      [chatId, current.persona || DEFAULT_PERSONA, current.moodTracking !== false, current.summary || null, current.coveredTurns || 0],
      "prefs"
    );
  }
  return prefs[chatId];
}

export async function getDigest(chatId, day) {
  const pool = db();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT line FROM kairos_digests WHERE chat_id = $1 AND day = $2", [chatId, day]);
      if (rows[0]) return rows[0].line;
    } catch {}
  }
  return loadFile("digests", {})[chatId]?.[day] || null;
}

export async function setDigest(chatId, day, line) {
  const digests = loadFile("digests", {});
  if (!digests[chatId]) digests[chatId] = {};
  digests[chatId][day] = String(line).slice(0, 300);
  const days = Object.keys(digests[chatId]).sort();
  for (const old of days.slice(0, Math.max(0, days.length - 30))) delete digests[chatId][old];
  saveFile("digests");

  await dbWrite(
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

export function resetCompanionCacheForTests() {
  cache.turns = null;
  cache.events = null;
  cache.moods = null;
  cache.prefs = null;
  cache.digests = null;
}
