import { createTask } from "../shared/schemas/task.js";
import { normalizeObjective, normalizeResolvedState, transitionId } from "../world/stateNormalization.js";

export function generateTransitions(currentState, desiredObjective, failedTransitions = {}) {
  console.log("[TRANSITION GENERATOR INPUT RECEIVED currentState]");
  console.log(JSON.stringify(currentState, null, 2));
  console.log("[TRANSITION GENERATOR INPUT RECEIVED desiredObjective]");
  console.log(JSON.stringify(desiredObjective, null, 2));

  const normalizedCurrentState = normalizeResolvedState(currentState);
  const normalizedDesiredObjective = normalizeObjective(desiredObjective);

  console.log("[TRANSITION INPUT]");
  console.log(JSON.stringify({
    currentPlatform: normalizedCurrentState.platform,
    currentState: normalizedCurrentState.currentState,
    desiredPlatform: normalizedDesiredObjective.platform,
    desiredState: normalizedDesiredObjective.desiredState,
    parameters: normalizedDesiredObjective.parameters
  }, null, 2));

  const candidates = [];
  const cleanCurPlatform = (normalizedCurrentState.platform || "").toLowerCase();
  const cleanCurState = (normalizedCurrentState.currentState || "").toLowerCase();
  const cleanObjPlatform = (normalizedDesiredObjective.platform || "").toLowerCase();
  const desiredState = normalizedDesiredObjective.desiredState;
  const legacyDesiredState = (normalizedDesiredObjective.legacyDesiredState || desiredState || "").toLowerCase();
  const legacyDesiredSegment = legacyDesiredState.startsWith(`${cleanObjPlatform}_`) ? legacyDesiredState : `${cleanObjPlatform}_${legacyDesiredState}`;

  // Candidate 1: Transition to target platform's home first if platforms don't match
  if (cleanCurPlatform !== cleanObjPlatform && 
      desiredState !== "home" && 
      desiredState !== "goal_completed") {
    
    const transId = transitionId(cleanCurState, "home");
    const legacyTransId = `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_home`;
    const failureCount = failedTransitions[transId] || failedTransitions[legacyTransId] || 0;
    
    // Calculate score & confidence
    let score = 0.8 - (failureCount * 0.25);
    let confidence = parseFloat(Math.max(0.1, 0.9 - (failureCount * 0.3)).toFixed(2));
    
    candidates.push({
      id: transId,
      legacyId: legacyTransId,
      desiredState: "home",
      state: "home",
      platform: normalizedDesiredObjective.platform,
      parameters: {},
      score,
      confidence
    });
  }

  // Candidate 2: Direct transition to the desired final state
  const directTransId = transitionId(cleanCurState, desiredState);
  const legacyDirectTransId = `${cleanCurPlatform}_${cleanCurState}_to_${legacyDesiredSegment}`;
  const directFailureCount = failedTransitions[directTransId] || failedTransitions[legacyDirectTransId] || 0;
  
  // Final state has higher direct priority if we are already on the right platform
  let directScore = (cleanCurPlatform === cleanObjPlatform ? 1.0 : 0.7) - (directFailureCount * 0.25);
  let directConfidence = parseFloat(Math.max(0.1, 0.95 - (directFailureCount * 0.3)).toFixed(2));

  candidates.push({
    id: directTransId,
    legacyId: legacyDirectTransId,
    desiredState,
    state: desiredState,
    legacyDesiredState: desiredObjective.desiredState,
    platform: normalizedDesiredObjective.platform,
    parameters: normalizedDesiredObjective.parameters || {},
    score: directScore,
    confidence: directConfidence
  });

  // Candidate 3: Navigation Fallback to target platform home if stuck
  const fallbackTransId = transitionId(cleanCurState, "home");
  const legacyFallbackTransId = `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_home`;
  const fallbackFailureCount = failedTransitions[fallbackTransId] || failedTransitions[legacyFallbackTransId] || 0;
  if (desiredState !== "home" && cleanCurState !== "home") {
    candidates.push({
      id: fallbackTransId,
      legacyId: legacyFallbackTransId,
      desiredState: "home",
      state: "home",
      platform: normalizedDesiredObjective.platform,
      parameters: {},
      score: 0.4 - (fallbackFailureCount * 0.2),
      confidence: parseFloat(Math.max(0.1, 0.7 - (fallbackFailureCount * 0.2)).toFixed(2))
    });
  }

  // Sort candidate transitions by score in descending order
  candidates.sort((a, b) => b.score - a.score);

  console.log(`[STATE MACHINE] Generated and ranked transitions:`, JSON.stringify(candidates.map(c => ({ id: c.id, score: c.score.toFixed(2), conf: c.confidence })), null, 2));

  console.log("[TRANSITION OUTPUT]");
  console.log(JSON.stringify(candidates, null, 2));

  return candidates;
}

export function generateTasksForTransitions(transitions) {
  return transitions.map(trans => {
    const platform = trans.platform || "generic";
    const platformUrl = platform.includes(".") ? platform : (platform === "generic" ? "https://google.com" : `https://${platform}.com`);

    switch (trans.desiredState) {
      case "home":
        return createTask({
          objective: `reach_${platform}_home`,
          intent: { type: "navigate", action: "navigate", target: platformUrl },
          successCriteria: [`URL contains ${platform}`]
        });

      case "results":
        return createTask({
          objective: `reach_${platform}_results`,
          intent: { type: "search", action: "search", query: trans.parameters.query },
          successCriteria: [`URL contains ${platform}`]
        });

      case "content":
        return createTask({
          objective: `reach_${platform}_content`,
          intent: { type: "media", action: "play", query: trans.parameters.query },
          successCriteria: [`URL contains ${platform}`]
        });

      case "login":
        return createTask({
          objective: `reach_${platform}_login`,
          intent: { type: "authenticate", action: "login", email: trans.parameters.email, password: trans.parameters.password },
          successCriteria: ["logged in"]
        });

      case "information_extracted":
        return createTask({
          objective: "reach_information_extracted",
          intent: { type: "extract", action: "extract", topic: trans.parameters.topic },
          successCriteria: ["data is extracted"]
        });

      default:
        return createTask({
          objective: "reach_goal_completed",
          intent: { type: "generic" },
          successCriteria: ["goal completed"]
        });
    }
  });
}
