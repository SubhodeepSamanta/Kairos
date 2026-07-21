import path from "path";
import { fileURLToPath } from "url";
import { readJson, writeJsonAtomic } from "../utils/jsonFile.js";
import { log } from "../utils/logger.js";
import { describeWhen } from "./when.js";

const TICK_MS = 20000;
const MAX_ENTRIES = 40;
const LATE_GRACE_MS = 6 * 3600 * 1000;

const FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "data", "schedule.json"
);

const persisting = process.env.NODE_ENV !== "test";

let entries = null;
let timer = null;
let runner = null;

function load() {
  if (entries) return entries;
  entries = persisting ? (readJson(FILE, []) || []) : [];
  if (!Array.isArray(entries)) entries = [];
  return entries;
}

function save() {
  if (!persisting) return;
  try { writeJsonAtomic(FILE, load()); } catch {}
}

export function scheduleGoal({ goal, at, repeatMs = null, chatId = "default" }) {
  const all = load();
  if (all.length >= MAX_ENTRIES) throw new Error(`you already have ${all.length} things scheduled — cancel one first`);
  const entry = {
    id: Math.random().toString(36).slice(2, 7),
    goal: String(goal).slice(0, 300),
    at: Number(at),
    repeatMs: repeatMs ? Number(repeatMs) : null,
    chatId,
    createdAt: Date.now()
  };
  all.push(entry);
  save();
  return entry;
}

export function listSchedule() {
  return [...load()].sort((a, b) => a.at - b.at);
}

export function cancelScheduled(id) {
  const all = load();
  const index = all.findIndex(e => e.id === String(id));
  if (index === -1) return null;
  const [removed] = all.splice(index, 1);
  save();
  return removed;
}

export function clearScheduleForTests() {
  entries = [];
}

export function dueEntries(now = Date.now()) {
  return load().filter(e => e.at <= now);
}

async function fire(entry, now) {
  const all = load();
  if (entry.repeatMs) {
    let next = entry.at + entry.repeatMs;
    while (next <= now) next += entry.repeatMs;
    entry.at = next;
  } else {
    const index = all.indexOf(entry);
    if (index !== -1) all.splice(index, 1);
  }
  save();

  const late = now - (entry.repeatMs ? now : entry.at);
  if (!entry.repeatMs && late > LATE_GRACE_MS) {
    log(`[SCHEDULE] skipping "${entry.goal}" — ${Math.round(late / 3600000)}h late, the moment has passed`);
    return;
  }

  log(`[SCHEDULE] firing "${entry.goal}"`);
  try {
    await runner?.(entry);
  } catch (err) {
    log(`[SCHEDULE] "${entry.goal}" failed: ${err.message}`);
  }
}

export async function tick(now = Date.now()) {
  const due = dueEntries(now);
  for (const entry of due) await fire(entry, now);
  return due.length;
}

export function startScheduler(runGoal, { intervalMs = TICK_MS } = {}) {
  runner = runGoal;
  if (timer) clearInterval(timer);
  timer = setInterval(() => { tick().catch(() => {}); }, intervalMs);
  if (timer.unref) timer.unref();
  const pending = load().length;
  if (pending) log(`[SCHEDULE] ${pending} thing${pending === 1 ? "" : "s"} waiting`);
  return timer;
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  runner = null;
}

export function formatSchedule(now = Date.now()) {
  const all = listSchedule();
  if (!all.length) return "nothing scheduled.";
  const lines = all.map(e => `  ${e.id}  ${describeWhen(e.at, e.repeatMs, now).padEnd(22)} ${e.goal}`);
  return `scheduled:\n${lines.join("\n")}\n\n/unschedule <id> to cancel one`;
}
