import { llmCallCount } from "../../llm/provider.js";

export function printMetrics(goal, startTime, startLlmCalls) {
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const llmCallsUsed = llmCallCount - startLlmCalls;
  const metrics = goal.metrics || { skillExecutions: 0, fallbackCount: 0, plannerPromptChars: 0, compressedPromptChars: 0, totalActions: 0, intent_calls: 0, planning_calls: 0, verification_calls: 0 };

  console.log(`
===== EXECUTION METRICS =====

Goal:
${goal.objective}

LLM Calls: ${llmCallsUsed}
  - intent_calls: ${metrics.intent_calls || 0}
  - planning_calls: ${metrics.planning_calls || 0}
  - verification_calls: ${metrics.verification_calls || 0}

Actions: ${metrics.totalActions || 0}
Skill Executions: ${metrics.skillExecutions}
Fallbacks: ${metrics.fallbackCount}

Duration: ${durationSec}s
===========================
`);
}

export function extractBrowserState(obs) {
  if (!obs) return {};
  const state = obs?.pageState || obs || {};
  return {
    url: state.url || obs.url || "",
    title: state.title || obs.title || "",
    text: state.text || obs.text || "",
    inputs: state.inputs || obs.inputs || [],
    buttons: state.buttons || obs.buttons || [],
    links: state.links || obs.links || [],
    pageType: state.pageType || obs.pageType || "",
    capabilities: state.capabilities || obs.capabilities || [],
    tabs: state.tabs || obs.tabs || [],
    activeTab: state.activeTab || obs.activeTab || null,
    pagePurpose: state.pagePurpose || obs.pagePurpose || "",
    ...state
  };
}

export function detectActionLoop(world) {
  if (!world) return false;
  const history = world.actionHistory || [];
  if (history.length < 4) return false;
  const last4 = history.slice(-4).map(h => {
    const a = h.action;
    return `${a.type}:${a.params?.element || ""}:${a.params?.url || ""}:${a.params?.text || ""}`;
  });
  if (last4[2] === last4[0] && last4[3] === last4[1] && last4[0] === last4[2]) {
    return true;
  }
  if (last4[1] === last4[2] && last4[2] === last4[3]) {
    return true;
  }
  return false;
}
