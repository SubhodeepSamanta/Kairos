import { askLLM } from "../llm/provider.js";

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end >= start ? text.slice(start, end + 1) : text;
}

function applyContext(intent, goalText, browserContext) {
  const normalized = {
    ...intent,
    goal: intent.goal || goalText,
    originalGoal: goalText
  };

  if (normalized.intent === "search" && !normalized.platform) {
    normalized.platform = browserContext.currentPlatform || "google";
  }
  if (normalized.intent === "action_on_page") {
    normalized.platform ||= browserContext.currentPlatform || null;
    normalized.useCurrentPage = true;
  }
  return normalized;
}

function parseSimpleIntent(goalText) {
  const text = goalText.trim();
  let match = text.match(/^search\s+([a-z0-9.-]+)\s+for\s+(.+)$/i);
  if (match) return { intent: "search", platform: match[1].trim(), query: match[2].trim() };

  match = text.match(/^(?:search(?:\s+for)?|find)\s+(.+?)(?:\s+on\s+([a-z0-9.-]+))?$/i);
  if (match) return { intent: "search", query: match[1].trim(), platform: match[2]?.trim() };

  match = text.match(/^(?:open|go\s+to|navigate\s+to|visit)\s+([a-z0-9.-]+)(?:\.com|\.org)?$/i);
  if (match) return { intent: "navigate", target: match[1].trim(), platform: match[1].trim() };

  if (/^(?:login|sign\s+in|authenticate)\b/i.test(text)) {
    return { intent: "action_on_page", goal: text };
  }

  if (/^(?:open|click|select|play|watch|apply|add|sort|filter|go\s+to)\b/i.test(text)) {
    return { intent: "action_on_page", goal: text };
  }
  return null;
}

export async function parseIntent(goalText, browserContext = {}) {
  const simpleIntent = parseSimpleIntent(goalText);
  if (simpleIntent) return applyContext(simpleIntent, goalText, browserContext);

  const systemPrompt = `Classify what the browser user wants. Do not plan steps and do not extract
domain-specific entities, ordinals, or target types. Return only JSON using one of:
{"intent":"search","query":"...","platform":"optional"}
{"intent":"navigate","target":"...","platform":"optional"}
{"intent":"action_on_page","goal":"verbatim user goal"}
{"intent":"generic","goal":"verbatim user goal"}`;

  try {
    const response = await askLLM(systemPrompt, goalText);
    return applyContext(JSON.parse(extractJson(response)), goalText, browserContext);
  } catch (error) {
    console.error("[intentParser] LLM classification failed:", error.message);
    return applyContext({ intent: "generic", goal: goalText }, goalText, browserContext);
  }
}
