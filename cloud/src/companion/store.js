import fs from "fs";
import path from "path";
import { memoryPool, isDbActive } from "../memory/db.js";
import { DEFAULT_PERSONA } from "./personas.js";

const KEEP_TURNS = 14;
const KEEP_EVENTS = 60;
const KEEP_MOODS = 80;

const dataDir = () => path.join(process.cwd(), "data");
const fileFor = (name) => path.join(dataDir(), `${name}.json`);

const cache = { turns: null, events: null, moods: null, prefs: null };

function loadFile(name, fallback) {
  if (cache[name]) return cache[name];
  try {
    cache[name] = JSON.parse(fs.readFileSync(fileFor(name), "utf8"));
  } catch {
    cache[name] = fallback;
  }
  return cache[name];
}

function saveFile(name) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(fileFor(name), JSON.stringify(cache[name], null, 2), "utf8");
}

function db() {
  return isDbActive() ? memoryPool() : null;
}

function trimList(list, keep) {
  if (list.length > keep) list.splice(0, list.length - keep);
}

export async function addTurn(chatId, role, text) {
  const clean = String(text || "").slice(0, 2000);
  if (!clean) return;

  const turns = loadFile("turns", {});
  if (!turns[chatId]) turns[chatId] = [];
  turns[chatId].push({ role, text: clean, at: new Date().toISOString() });
  trimList(turns[chatId], KEEP_TURNS);
  saveFile("turns");

  const pool = db();
  if (pool) {
    try {
      await pool.query("INSERT INTO kairos_turns (chat_id, role, text) VALUES ($1, $2, $3)", [chatId, role, clean]);
    } catch (err) {
      console.log(`[COMPANION] turn write failed: ${err.message.slice(0, 60)}`);
    }
  }
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
  return (loadFile("turns", {})[chatId] || []).slice(-KEEP_TURNS);
}

export async function addEvent(chatId, summary, success, steps) {
  const events = loadFile("events", {});
  if (!events[chatId]) events[chatId] = [];
  events[chatId].push({ summary: String(summary).slice(0, 300), success, steps, at: new Date().toISOString() });
  trimList(events[chatId], KEEP_EVENTS);
  saveFile("events");

  const pool = db();
  if (pool) {
    try {
      await pool.query("INSERT INTO kairos_events (chat_id, summary, success, steps) VALUES ($1, $2, $3, $4)", [
        chatId, String(summary).slice(0, 300), success, steps
      ]);
    } catch {}
  }
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

  const pool = db();
  if (pool) {
    try {
      await pool.query("INSERT INTO kairos_moods (chat_id, label, confidence, why) VALUES ($1, $2, $3, $4)", [
        chatId, label, confidence, String(why || "").slice(0, 160)
      ]);
    } catch {}
  }
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
  const prefs = loadFile("prefs", {});
  prefs[chatId] = { ...(prefs[chatId] || {}), ...patch };
  saveFile("prefs");

  const pool = db();
  if (pool) {
    try {
      const current = prefs[chatId];
      await pool.query(
        `INSERT INTO kairos_prefs (chat_id, persona, mood_tracking, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET persona = EXCLUDED.persona, mood_tracking = EXCLUDED.mood_tracking, updated_at = NOW()`,
        [chatId, current.persona || DEFAULT_PERSONA, current.moodTracking !== false]
      );
    } catch {}
  }
  return prefs[chatId];
}

export async function forgetChat(chatId, what) {
  const pool = db();
  const tables = { turns: "kairos_turns", events: "kairos_events", moods: "kairos_moods" };
  const targets = what === "all" ? Object.keys(tables) : [what];

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
}
