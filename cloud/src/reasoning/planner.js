import { askLLM } from "../llm/provider.js";
import { normalizeStateName } from "../world/stateNormalization.js";

const EXECUTABLE_STATES = new Set([
  "home", "results", "result_selected", "content", "login", "settings",
  "information_extracted", "new_tab", "switch_tab", "close_tab"
]);

function extractJson(text) {
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd >= arrayStart) return text.slice(arrayStart, arrayEnd + 1);
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  return objectStart >= 0 && objectEnd >= objectStart ? text.slice(objectStart, objectEnd + 1) : text;
}

function normalizeObjectives(rawObjectives, intent, browserContext) {
  const fallbackPlatform = intent.platform || browserContext.currentPlatform || "google";
  return rawObjectives.map((raw, index) => {
    const desiredState = normalizeStateName(raw.desiredState || raw.state, raw.platform || fallbackPlatform);
    if (!EXECUTABLE_STATES.has(desiredState)) throw new Error(`Unsupported planner state: ${desiredState}`);
    return {
      id: `obj${index + 1}`,
      desiredState,
      semanticTarget: raw.semanticTarget || null,
      platform: raw.platform || fallbackPlatform,
      parameters: { goal: intent.goal || intent.originalGoal, ...(raw.parameters || {}) },
      successConditions: raw.successConditions?.length ? raw.successConditions : [`state is ${desiredState}`],
      priority: rawObjectives.length - index,
      dependencies: index ? [`obj${index}`] : [],
      confidence: Number(raw.confidence) || 0.8,
      openQuestions: raw.openQuestions || []
    };
  });
}

function fallbackPlan(intent, browserContext) {
  const platform = intent.platform || browserContext.currentPlatform || "google";
  const goal = intent.goal || intent.originalGoal || "";
  if (intent.intent === "navigate") {
    return [{ desiredState: "home", platform, parameters: { url: intent.target || platform } }];
  }
  if (intent.intent === "search") {
    return [{ desiredState: "results", platform, parameters: { query: intent.query } }];
  }
  return [{
    desiredState: "result_selected",
    platform,
    semanticTarget: "goal_relevant_content",
    parameters: { goal, useCurrentPage: true }
  }];
}

export async function planObjectives(goalText, intent, browserContext = {}) {
  const plannerPrompt = `You are Kairos's semantic browser planner. Decide HOW to accomplish the goal.
Return only a JSON array of concise objectives. Available executable states are:
home, results, result_selected, content, login, settings, information_extracted,
new_tab, switch_tab, close_tab.
Each item: {"desiredState":"...","platform":"...","semanticTarget":"optional page kind",
"parameters":{},"successConditions":[]}.
Use observed page context. Do not invent selectors, element IDs, URLs, or website-specific actions.
Prefer the fewest useful objectives. Put the full user goal in selection parameters so candidates can
be ranked against it. If already on the right platform/page, do not navigate home first.`;
  const plannerInput = JSON.stringify({ goal: goalText, intent, browserContext }, null, 2);

  try {
    const response = await askLLM(plannerPrompt, plannerInput);
    const parsed = JSON.parse(extractJson(response));
    const rawObjectives = Array.isArray(parsed) ? parsed : parsed.objectives;
    if (!Array.isArray(rawObjectives) || rawObjectives.length === 0) throw new Error("Planner returned no objectives");
    return normalizeObjectives(rawObjectives, intent, browserContext);
  } catch (error) {
    console.error("[PLANNER] Dynamic planning failed; using generic fallback:", error.message);
    return normalizeObjectives(fallbackPlan(intent, browserContext), intent, browserContext);
  }
}
