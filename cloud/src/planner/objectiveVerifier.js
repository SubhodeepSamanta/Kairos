import { resolveCurrentState } from "./currentStateResolver.js";

export function verifyObjectiveState(objective, resolvedState) {
  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") {
    return false; 
  }

  const cleanObjPlatform = (objective.platform || "").toLowerCase().replace(/\.com|\.org|\.net/g, "");
  const cleanResPlatform = (resolvedState.platform || "").toLowerCase().replace(/\.com|\.org|\.net/g, "");

  if (cleanObjPlatform && cleanObjPlatform !== "generic" && cleanObjPlatform !== cleanResPlatform) {
    return false;
  }


  if (objective.desiredState === "home") {
    return cleanObjPlatform === cleanResPlatform;
  }

  if (objective.desiredState === resolvedState.currentState) {
    if (objective.desiredState === "results" && objective.parameters?.query) {
      const objQuery = objective.parameters.query.toLowerCase().trim();
      const resQuery = (resolvedState.parameters?.query || "").toLowerCase().trim();
      if (resQuery && (resQuery.includes(objQuery) || objQuery.includes(resQuery))) {
        return true;
      }
      return true;
    }
    return true;
  }

  return false;
}

export function verifyObjective(objective, observation) {
  const resolved = resolveCurrentState(observation);
  const matched = verifyObjectiveState(objective, resolved);
  if (matched) return true;

  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") {
    return observation?.success === true;
  }
  return false;
}
