const MAX_STEPS_KEPT = 40;

let last = null;

export function recordTrace(trace) {
  last = {
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
  return last;
}

export function lastTrace() {
  return last;
}

export function clearTrace() {
  last = null;
}

export function formatTrace(trace) {
  if (!trace) return "nothing has run yet.";
  const outcome = trace.cancelled ? "stopped" : trace.success ? "worked" : "did not work";
  const head = `"${trace.goal}" — ${outcome} in ${trace.steps.length} step${trace.steps.length === 1 ? "" : "s"}, ${trace.seconds}s, ${trace.llmCalls} AI call${trace.llmCalls === 1 ? "" : "s"}`;
  if (!trace.steps.length) return `${head}\n\nshe answered without touching the browser.`;
  return `${head}\n\n${trace.steps.join("\n")}`;
}
