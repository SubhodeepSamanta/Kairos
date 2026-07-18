import { askLLM } from "../llm/provider.js";
import { loadEvents, getDigest, setDigest } from "./store.js";

const SYSTEM = `Compress one day of an assistant's activity log into ONE line under 25 words, the way a friend would recall the day ("opened 3 LeetCode problems (2 solved), played lofi twice"). Keep counts and outcomes. No preamble.`;

const MAX_DIGEST_CHARS = 200;
const MIN_EVENTS_FOR_LLM = 3;

export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function labelFor(key, todayKey) {
  const [y, m, d] = key.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const days = Math.round((new Date(ty, tm - 1, td) - new Date(y, m - 1, d)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function rawLine(list) {
  const done = list.filter(e => e.success).length;
  const items = list.slice(0, 5).map(e => e.summary).join("; ");
  return `${items}${list.length > 5 ? ` (+${list.length - 5} more)` : ""} [${done}/${list.length} worked]`;
}

async function compressDay(list) {
  const log = list.map(e => `${e.summary}${e.success ? "" : " (failed)"}`).join("\n");
  const reply = String(await askLLM(SYSTEM, log)).trim().replace(/\s+/g, " ");
  return reply ? reply.slice(0, MAX_DIGEST_CHARS) : null;
}

export async function buildRecentDays(chatId) {
  const events = await loadEvents(chatId, 4);
  if (!events.length) return "(nothing recorded yet)";

  const today = dayKey(new Date());
  const byDay = new Map();
  for (const e of events) {
    const key = dayKey(e.at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(e);
  }

  const lines = [];
  for (const key of [...byDay.keys()].sort().reverse()) {
    const list = byDay.get(key);
    if (key === today) {
      lines.push(`today: ${rawLine(list)}`);
      continue;
    }
    let line = await getDigest(chatId, key);
    if (!line) {
      line = rawLine(list);
      if (list.length >= MIN_EVENTS_FOR_LLM) {
        try {
          line = (await compressDay(list)) || line;
        } catch {}
      }
      await setDigest(chatId, key, line);
    }
    lines.push(`${labelFor(key, today)}: ${line}`);
  }
  return lines.join("\n");
}
