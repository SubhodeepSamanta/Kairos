import { resolveCurrentState } from "./currentStateResolver.js";

export function verifyObjectiveState(objective, resolvedState, observation) {
  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") {
    return false; 
  }

  const cleanObjPlatform = (objective.platform || "").toLowerCase().replace(/\.com|\.org|\.net/g, "");
  const cleanResPlatform = (resolvedState.platform || "").toLowerCase().replace(/\.com|\.org|\.net/g, "");

  if (cleanObjPlatform && cleanObjPlatform !== "generic" && cleanObjPlatform !== cleanResPlatform) {
    return false;
  }

  // 1. Home state verification
  if (objective.desiredState === "home") {
    const isPlatformMatched = cleanObjPlatform === cleanResPlatform;
    if (!isPlatformMatched) return false;
    // Semantic match: title or URL should indicate home/main portal
    const url = (observation?.url || "").toLowerCase();
    const title = (observation?.title || "").toLowerCase();
    return url.length > 0 && (url.endsWith("/") || url.includes("home") || title.includes("home") || !url.includes("search") && !url.includes("watch"));
  }

  // 2. Results state verification
  if (objective.desiredState === "results") {
    if (resolvedState.currentState !== "results") return false;

    // Query Match
    if (objective.parameters?.query) {
      const objQuery = objective.parameters.query.toLowerCase().trim();
      const resQuery = (resolvedState.parameters?.query || "").toLowerCase().trim();
      const title = (observation?.title || "").toLowerCase();
      
      const queryMatched = resQuery.includes(objQuery) || objQuery.includes(resQuery) || title.includes(objQuery);
      if (!queryMatched) return false;
    }

    // Element Match: Check if we have results links
    const candidateLinks = (observation?.links || []).filter(link => {
      return ["result_link", "video_link", "product_link", "post_link", "search_link"].includes(link.purpose);
    });
    if (candidateLinks.length === 0 && (observation?.links || []).length > 0) {
      // If no semantic result links, check if generic links exist as a fallback
      const hasGenericLinks = (observation?.links || []).some(link => link.purpose !== "home_link" && link.purpose !== "profile_link");
      if (!hasGenericLinks) return false;
    }

    return true;
  }

  // 3. Video playing verification
  if (objective.desiredState === "video_playing") {
    const url = (observation?.url || "").toLowerCase();
    const isVideoUrl = url.includes("watch") || url.includes("video") || resolvedState.currentState === "video_playing";
    return isVideoUrl;
  }

  // Generic fallback if states match
  if (objective.desiredState === resolvedState.currentState) {
    return true;
  }

  return false;
}

export function verifyObjective(objective, observation) {
  const resolved = resolveCurrentState(observation);
  const matched = verifyObjectiveState(objective, resolved, observation);
  if (matched) return true;

  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") {
    return observation?.success === true;
  }
  return false;
}
