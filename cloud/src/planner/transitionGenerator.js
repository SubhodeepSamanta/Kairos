import { createTask } from "../shared/schemas/task.js";

export function generateTransitions(currentState, desiredObjective) {
  const transitions = [];
  const cleanCurPlatform = (currentState.platform || "").toLowerCase();
  const cleanCurState = (currentState.currentState || "").toLowerCase();
  const cleanObjPlatform = (desiredObjective.platform || "").toLowerCase();

  // If platforms are different, and desired target isn't already home, transition to home first
  if (cleanCurPlatform !== cleanObjPlatform && 
      desiredObjective.desiredState !== "home" && 
      desiredObjective.desiredState !== "goal_completed") {
    transitions.push({
      id: `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_home`,
      desiredState: "home",
      platform: desiredObjective.platform,
      parameters: {}
    });
  }

  // Push final state target
  const fromPlatform = transitions.length > 0 ? cleanObjPlatform : cleanCurPlatform;
  const fromState = transitions.length > 0 ? "home" : cleanCurState;
  transitions.push({
    id: `${fromPlatform}_${fromState}_to_${cleanObjPlatform}_${desiredObjective.desiredState}`,
    desiredState: desiredObjective.desiredState,
    platform: desiredObjective.platform,
    parameters: desiredObjective.parameters || {}
  });

  return transitions;
}

export function generateTasksForTransitions(transitions) {
  return transitions.map(trans => {
    const platform = trans.platform || "google";
    const platformUrl = platform.includes(".") ? platform : `${platform}.com`;

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
