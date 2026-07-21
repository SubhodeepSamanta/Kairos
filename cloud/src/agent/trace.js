import path from "path";
import { fileURLToPath } from "url";
import { readJson, writeJsonAtomic } from "../utils/jsonFile.js";

const MAX_STEPS_KEPT = 40;
const MAX_TRACES_KEPT = 50;

const TRACE_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "data", "traces.json"
);

const persisting = process.env.NODE_ENV !== "test";

let history = null;

function load() {
  if (history) return history;
  history = persisting ? (readJson(TRACE_FILE, []) || []) : [];
  if (!Array.isArray(history)) history = [];
  return history;
}

export function recordTrace(trace) {
  const entry = {
    goal: String(trace.goal || "").slice(0, 200),
    success: Boolean(trace.success),
    cancelled: Boolean(trace.cancelled),
    answer: String(trace.answer || "").slice(0, 400),
    steps: (trace.steps || []).slice(-MAX_STEPS_KEPT),
    seconds: Number(trace.seconds) || 0,
    llmCalls: Number(trace.llmCalls) || 0,
    tokens: Number(trace.tokens) || 0,
    at: Date.now()
  };

  const all = load();
  all.push(entry);
  if (all.length > MAX_TRACES_KEPT) all.splice(0, all.length - MAX_TRACES_KEPT);

  if (persisting) {
    try { writeJsonAtomic(TRACE_FILE, all); } catch {}
  }
  return entry;
}

export function lastTrace() {
  const all = load();
  return all.length ? all[all.length - 1] : null;
}

export function recentTraces(limit = 10) {
  return load().slice(-limit).reverse();
}

export function clearTrace() {
  history = [];
}

export function formatTrace(trace) {
  if (!trace) return "nothing has run yet.";
  const outcome = trace.cancelled ? "stopped" : trace.success ? "worked" : "did not work";
  const head = `"${trace.goal}" — ${outcome} in ${trace.steps.length} step${trace.steps.length === 1 ? "" : "s"}, ${trace.seconds}s, ${trace.llmCalls} AI call${trace.llmCalls === 1 ? "" : "s"}`;
  if (!trace.steps.length) return `${head}\n\nshe answered without touching the browser.`;
  return `${head}\n\n${trace.steps.join("\n")}`;
}
