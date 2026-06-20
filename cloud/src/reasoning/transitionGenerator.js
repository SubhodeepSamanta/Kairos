import { createTask } from "../shared/schemas/task.js";

export function generateTransitions(currentState, desiredObjective, failedTransitions = {}) {
  const candidates = [];
  const cleanCurPlatform = (currentState.platform || "").toLowerCase();
  const cleanCurState = (currentState.currentState || "").toLowerCase();
  const cleanObjPlatform = (desiredObjective.platform || "").toLowerCase();

  // Candidate 1: Transition to target platform's home first if platforms don't match
  if (cleanCurPlatform !== cleanObjPlatform && 
      desiredObjective.desiredState !== "home" && 
      desiredObjective.desiredState !== "goal_completed") {
    
    const transId = `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_home`;
    const failureCount = failedTransitions[transId] || 0;
    
    // Calculate score & confidence
    let score = 0.8 - (failureCount * 0.25);
    let confidence = parseFloat(Math.max(0.1, 0.9 - (failureCount * 0.3)).toFixed(2));
    
    candidates.push({
      id: transId,
      desiredState: "home",
      platform: desiredObjective.platform,
      parameters: {},
      score,
      confidence
    });
  }

  // Candidate 2: Direct transition to the desired final state
  const directTransId = `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_${desiredObjective.desiredState}`;
  const directFailureCount = failedTransitions[directTransId] || 0;
  
  // Final state has higher direct priority if we are already on the right platform
  let directScore = (cleanCurPlatform === cleanObjPlatform ? 1.0 : 0.7) - (directFailureCount * 0.25);
  let directConfidence = parseFloat(Math.max(0.1, 0.95 - (directFailureCount * 0.3)).toFixed(2));

  candidates.push({
    id: directTransId,
    desiredState: desiredObjective.desiredState,
    platform: desiredObjective.platform,
    parameters: desiredObjective.parameters || {},
    score: directScore,
    confidence: directConfidence
  });

  // Candidate 3: Navigation Fallback to target platform home if stuck
  const fallbackTransId = `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_home`;
  const fallbackFailureCount = failedTransitions[fallbackTransId] || 0;
  if (desiredObjective.desiredState !== "home" && cleanCurState !== "home") {
    candidates.push({
      id: fallbackTransId,
      desiredState: "home",
      platform: desiredObjective.platform,
      parameters: {},
      score: 0.4 - (fallbackFailureCount * 0.2),
      confidence: parseFloat(Math.max(0.1, 0.7 - (fallbackFailureCount * 0.2)).toFixed(2))
    });
  }

  // Sort candidate transitions by score in descending order
  candidates.sort((a, b) => b.score - a.score);

  console.log(`[STATE MACHINE] Generated and ranked transitions:`, JSON.stringify(candidates.map(c => ({ id: c.id, score: c.score.toFixed(2), conf: c.confidence })), null, 2));

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

      case "video_playing":
        return createTask({
          objective: `reach_${platform}_video_playing`,
          intent: { type: "media", action: "play", query: trans.parameters.query },
          successCriteria: [`URL contains ${platform}`]
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
