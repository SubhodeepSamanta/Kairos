import { memoryPool, isDbActive } from "../memory/db.js";
import { seedStoreIfEmpty } from "./store.js";

const ARCHIVE_TURNS = 300;
const KEEP_EVENTS = 60;
const KEEP_MOODS = 80;

function grouped(rows, keyField, keep, toEntry) {
  const out = {};
  for (const r of rows) {
    const id = r[keyField];
    if (!out[id]) out[id] = [];
    out[id].push(toEntry(r));
  }
  for (const id of Object.keys(out)) {
    if (out[id].length > keep) out[id] = out[id].slice(-keep);
  }
  return out;
}

export async function hydrateCompanionFromDb() {
  if (!isDbActive()) return [];
  const pool = memoryPool();
  const seeded = [];

  try {
    const turns = await pool.query("SELECT chat_id, role, text, said_at FROM kairos_turns ORDER BY said_at ASC");
    const totals = {};
    for (const r of turns.rows) totals[r.chat_id] = (totals[r.chat_id] || 0) + 1;
    const lists = grouped(turns.rows, "chat_id", ARCHIVE_TURNS, r => ({
      role: r.role, text: r.text, at: new Date(r.said_at).toISOString()
    }));
    const data = {};
    for (const id of Object.keys(lists)) {
      data[id] = { list: lists[id], dropped: totals[id] - lists[id].length };
    }
    if (Object.keys(data).length && seedStoreIfEmpty("turns", data)) seeded.push("turns");

    const events = await pool.query("SELECT chat_id, summary, success, steps, happened_at FROM kairos_events ORDER BY happened_at ASC");
    const eventData = grouped(events.rows, "chat_id", KEEP_EVENTS, r => ({
      summary: r.summary, success: r.success, steps: r.steps, at: new Date(r.happened_at).toISOString()
    }));
    if (Object.keys(eventData).length && seedStoreIfEmpty("events", eventData)) seeded.push("events");

    const moods = await pool.query("SELECT chat_id, label, confidence, why, noted_at FROM kairos_moods ORDER BY noted_at ASC");
    const moodData = grouped(moods.rows, "chat_id", KEEP_MOODS, r => ({
      label: r.label, confidence: r.confidence, why: r.why, at: new Date(r.noted_at).toISOString()
    }));
    if (Object.keys(moodData).length && seedStoreIfEmpty("moods", moodData)) seeded.push("moods");

    const prefs = await pool.query("SELECT chat_id, persona, mood_tracking, summary, covered_turns FROM kairos_prefs");
    const prefData = {};
    for (const r of prefs.rows) {
      prefData[r.chat_id] = {
        persona: r.persona || undefined,
        moodTracking: r.mood_tracking !== false,
        summary: r.summary || "",
        coveredTurns: r.covered_turns || 0
      };
    }
    if (Object.keys(prefData).length && seedStoreIfEmpty("prefs", prefData)) seeded.push("prefs");

    const digests = await pool.query("SELECT chat_id, day, line FROM kairos_digests");
    const digestData = {};
    for (const r of digests.rows) {
      if (!digestData[r.chat_id]) digestData[r.chat_id] = {};
      digestData[r.chat_id][r.day] = r.line;
    }
    if (Object.keys(digestData).length && seedStoreIfEmpty("digests", digestData)) seeded.push("digests");
  } catch (err) {
    console.log(`[COMPANION] hydration from Postgres skipped: ${err.message.slice(0, 80)}`);
  }

  if (seeded.length) console.log(`[COMPANION] hydrated ${seeded.join(", ")} from Postgres (fresh local store)`);
  return seeded;
}
