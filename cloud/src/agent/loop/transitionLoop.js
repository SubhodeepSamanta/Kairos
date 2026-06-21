import { generateTransitions } from "../../reasoning/transitionGenerator.js";
import { generateExecutionSummary } from "../../world/executionContext.js";
import { isDebug } from "../../utils/logger.js";

export function processTransitions({
  goal,
  resolvedCurState,
  currentObj,
  failedTransitions,
  latestObs,
  context,
  totalActions,
  MAX_GOAL_ACTIONS
}) {
  const transitions = generateTransitions(resolvedCurState, currentObj, failedTransitions);
  if (transitions.length === 0) {
    console.log("[AGENT] No transitions generated. Target might be reached.");
    const summary = generateExecutionSummary(context, goal.tracker);
    if (isDebug()) {
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    } else {
      console.log(`[EXECUTION SUMMARY] duration=${summary.durationSec || ""} actions=${summary.totalActions || ""} success=${summary.success || ""}`);
    }
    return {
      shouldExit: true,
      exitValue: {
        success: true,
        confidence: 0.9,
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  const activeTransition = transitions[0];

  if (isDebug()) {
    console.log(`
=========================================
CURRENT STATE: platform="${resolvedCurState.platform}" state="${resolvedCurState.currentState}" (query="${resolvedCurState.parameters?.query || ""}")
DESIRED STATE: platform="${currentObj.platform}" state="${currentObj.desiredState}" (query="${currentObj.parameters?.query || ""}")
TRANSITIONS: ${transitions.map(t => `${t.id} (${t.score.toFixed(2)})`).join(", ")}
ACTIVE TRANSITION: ${activeTransition.id} (confidence: ${activeTransition.confidence})
=========================================
`);
    console.log("[TRANSITION]", activeTransition);
  } else {
    console.log(`[TRANSITION]\n${activeTransition.id}`);
  }

  if (totalActions > MAX_GOAL_ACTIONS) {
    console.log(`[BUDGET] Goal exceeded max actions of ${MAX_GOAL_ACTIONS}`);
    const summary = generateExecutionSummary(context, goal.tracker);
    if (isDebug()) {
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    } else {
      console.log(`[EXECUTION SUMMARY] duration=${summary.durationSec || ""} actions=${summary.totalActions || ""} success=${summary.success || ""}`);
    }
    return {
      shouldExit: true,
      exitValue: {
        success: false,
        reason: "goal_action_budget_exceeded",
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  return { shouldExit: false, activeTransition };
}
