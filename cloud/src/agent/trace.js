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

function costFor(trace) {
  const rate = Number(process.env.LLM_COST_PER_MTOK) || 0;
  if (!rate || !trace.measured) return null;
  const total = (Number(trace.tokensIn) || 0) + (Number(trace.tokensOut) || 0);
  return (total / 1e6) * rate;
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
    tokensIn: Number(trace.tokensIn) || 0,
    tokensOut: Number(trace.tokensOut) || 0,
    measured: Boolean(trace.measured),
    llmMs: Number(trace.llmMs) || 0,
    cost: costFor(trace),
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
  const head = `"${trace.goal}" — ${outcome} in ${trace.steps.length} step${trace.steps.length === 1 ? "" : "s"}, ${Number(trace.seconds).toFixed(1)}s, ${trace.llmCalls} AI call${trace.llmCalls === 1 ? "" : "s"}`;
  const cost = [];
  if (trace.tokens) {
    cost.push(trace.measured
      ? `${trace.tokens} tokens (${trace.tokensIn} in, ${trace.tokensOut} out)`
      : `~${trace.tokens} tokens (estimated)`);
  }
  if (trace.llmMs) cost.push(`${(trace.llmMs / 1000).toFixed(1)}s of that waiting on the AI`);
  if (typeof trace.cost === "number") cost.push(`$${trace.cost.toFixed(4)}`);
  const body = cost.length ? `${head}\n${cost.join(" · ")}` : head;
  if (!trace.steps.length) return `${body}\n\nshe answered without touching the browser.`;
  return `${body}\n\n${trace.steps.join("\n")}`;
}
