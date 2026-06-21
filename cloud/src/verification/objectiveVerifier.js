import { resolveCurrentState } from "../world/currentStateResolver.js";

export function evaluateState(objective, resolvedState, observation) {
  const matched = verifyGoal(objective.objective || objective.desiredState || "", observation?.pageState || observation);
  return {
    matched,
    confidence: matched ? 0.95 : 0,
    reason: matched ? "Goal verified satisfied" : "Goal not verified yet"
  };
}

export function verifyObjective(objective, observation) {
  return verifyGoal(objective.objective || objective.desiredState || "", observation?.pageState || observation);
}

export function verifyGoal(goal, browserState, worldState = null) {
  if (!goal) return false;
  if (!browserState) return false;

  const goalLower = goal.toLowerCase();
  const url = (browserState.url || "").toLowerCase();
  const title = (browserState.title || "").toLowerCase();
  const text = (browserState.text || "").toLowerCase();
  const pageType = (browserState.pageType || "").toLowerCase();

  const isExtractGoal = /extract|get|find|retrieve|price|stars|info/i.test(goalLower);
  const isPlayGoal = /play|video|music/i.test(goalLower);
  const isSearchGoal = /search|find/i.test(goalLower);
  const isLoginGoal = /login|sign in/i.test(goalLower);
  const isNavGoal = /open|go to|visit|navigate/i.test(goalLower);

  // 1. Extraction goals
  if (isExtractGoal) {
    if (worldState?.findings && worldState.findings.length > 0) {
      return true;
    }
    if (text.includes("data extracted success") || text.includes("[data extracted success]")) {
      return true;
    }
    if (pageType.includes("details") || url.includes("details")) {
      return true;
    }
    return false;
  }

  // 2. Play video / audio
  if (isPlayGoal) {
    if (url.includes("/watch") || url.includes("/shorts") || pageType.includes("video_playing") || pageType.includes("video") || title.includes("watch")) {
      return true;
    }
    return false;
  }

  // 3. Search and results
  if (isSearchGoal) {
    if (url.includes("search") || url.includes("results") || pageType.includes("results")) {
      return true;
    }
    return false;
  }

  // 4. Login flow
  if (isLoginGoal) {
    if (pageType.includes("logged_in") || pageType.includes("details") || (worldState && worldState.authenticated)) {
      return true;
    }
    return false;
  }

  // 5. Open homepage / navigation
  if (isNavGoal) {
    const platforms = ["youtube", "github", "amazon", "google", "wikipedia", "reddit"];
    for (const p of platforms) {
      if (goalLower.includes(p) && url.includes(p)) {
        return true;
      }
    }
    if (pageType.includes("home") || pageType.includes("landing") || url.startsWith("http")) {
      return true;
    }
    return false;
  }

  return false;
}
