import { resolveCurrentState } from "../world/currentStateResolver.js";
import { normalizeObjective, normalizeResolvedState } from "../world/stateNormalization.js";
import { isDebug } from "../utils/logger.js";

const CONTENT_SEMANTIC_STATES = new Set([
  "content_page",
  "repository_page",
  "video_page",
  "channel_page",
  "product_page",
  "checkout_page",
  "profile_page"
]);

function normalizePlatform(value) {
  return (value || "").toLowerCase().replace(/\s+/g, "").replace(/\.(com|org|net)$/, "");
}

function matchesPlatform(objective, resolvedState) {
  const expected = normalizePlatform(objective.platform);
  const actual = normalizePlatform(resolvedState.platform);
  return !expected || expected === "generic" || expected === "blank" || expected === actual;
}

function matchesSemanticState(objective, resolvedState) {
  const desiredState = objective.desiredState;
  const semanticState = resolvedState.semanticState;

  // A planner-provided semantic target is an exact page-kind contract.
  if (objective.semanticTarget) return semanticState === objective.semanticTarget;

  switch (desiredState) {
    case "home":
      return resolvedState.currentState === "home" && semanticState === "home_active";
    case "results":
      return resolvedState.currentState === "results" && semanticState === "search_results";
    case "content":
    case "result_selected":
    case "product_details":
      return resolvedState.currentState === "content" && CONTENT_SEMANTIC_STATES.has(semanticState);
    case "login":
      return resolvedState.currentState === "login" && ["login_page", "authenticated"].includes(semanticState);
    case "settings":
      return resolvedState.currentState === "settings" && semanticState === "settings_page";
    case "navigate":
      return resolvedState.currentState !== "blank";
    case "new_tab":
    case "switch_tab":
    case "close_tab":
      return true;
    default:
      return false;
  }
}

function matchesNavigationTarget(objective, observation) {
  if (objective.desiredState !== "navigate") return true;
  const browser = observation?.pageState || observation || {};
  const currentUrl = (observation?.url || browser.url || "").toLowerCase();
  const target = (objective.parameters?.url || "").toLowerCase();
  return Boolean(currentUrl) && (!target || currentUrl.includes(target));
}

export function evaluateState(objective, resolvedState, observation) {
  objective = normalizeObjective(objective);
  resolvedState = normalizeResolvedState(resolvedState);

  const platformMatch = matchesPlatform(objective, resolvedState);
  const semanticMatch = matchesSemanticState(objective, resolvedState);
  const targetMatch = matchesNavigationTarget(objective, observation);
  const finalMatch = platformMatch && semanticMatch && targetMatch;

  if (isDebug()) {
    console.log(`[VERIFY]\n  Objective: ${objective.desiredState}\n  Semantic target: ${objective.semanticTarget || "none"}\n  Actual: { platform: "${resolvedState.platform}", state: "${resolvedState.currentState}", semanticState: "${resolvedState.semanticState}" }\n  Checks:\n    platform_match=${platformMatch}\n    semantic_match=${semanticMatch}\n    target_match=${targetMatch}\n  Final: ${finalMatch ? "SUCCESS" : "FAIL"}`);
  }

  return {
    matched: finalMatch,
    confidence: finalMatch ? 0.95 : 0,
    reason: `PlatformMatch: ${platformMatch}, SemanticMatch: ${semanticMatch}, TargetMatch: ${targetMatch}`
  };
}

export function verifyObjectiveState(objective, resolvedState, observation) {
  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") return false;
  return evaluateState(objective, resolvedState, observation).matched;
}

export function verifyObjective(objective, observation) {
  const resolved = resolveCurrentState(observation);
  if (verifyObjectiveState(objective, resolved, observation)) return true;
  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") {
    return observation?.success === true;
  }
  return false;
}
