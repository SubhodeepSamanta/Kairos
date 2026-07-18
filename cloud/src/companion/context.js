import { loadTurns, loadEvents, loadMoods, getPrefs, getSummary } from "./store.js";

function dayLabel(date) {
  const now = new Date();
  const then = new Date(date);
  const days = Math.floor((startOfDay(now) - startOfDay(then)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function formatConversation(turns) {
  if (!turns.length) return "(nothing yet — this is your first exchange)";
  return turns.map(t => `${t.role === "user" ? "them" : "you"}: ${t.text.slice(0, 300)}`).join("\n");
}

export function formatEvents(events) {
  if (!events.length) return "(nothing recorded yet)";

  const byDay = new Map();
  for (const e of events) {
    const label = dayLabel(e.at);
    if (!byDay.has(label)) byDay.set(label, []);
    byDay.get(label).push(e);
  }

  const lines = [];
  for (const [label, list] of byDay) {
    const done = list.filter(e => e.success).length;
    const items = list.slice(0, 5).map(e => e.summary).join("; ");
    lines.push(`${label}: ${items}${list.length > 5 ? ` (+${list.length - 5} more)` : ""} [${done}/${list.length} worked]`);
  }
  return lines.join("\n");
}

export function formatMood(moods) {
  if (!moods.length) return "(no read yet)";

  const latest = moods[moods.length - 1];
  const counts = {};
  for (const m of moods) counts[m.label] = (counts[m.label] || 0) + 1;
  const trend = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, n]) => `${label}${n > 1 ? ` x${n}` : ""}`)
    .join(", ");

  return `latest: ${latest.label} (${Number(latest.confidence).toFixed(1)}${latest.why ? `, "${latest.why}"` : ""}) · this week: ${trend}`;
}

export async function buildCompanionContext(chatId) {
  const prefs = await getPrefs(chatId);
  const [turns, events, moods, summary] = await Promise.all([
    loadTurns(chatId),
    loadEvents(chatId),
    prefs.moodTracking ? loadMoods(chatId) : Promise.resolve([]),
    getSummary(chatId)
  ]);

  return {
    prefs,
    turns,
    summary: summary.text,
    conversation: formatConversation(turns),
    recentDays: formatEvents(events),
    mood: prefs.moodTracking ? formatMood(moods) : "(mood tracking is off)"
  };
}
