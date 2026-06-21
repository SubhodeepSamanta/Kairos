import { diagnose } from "./diagnoser.js";
import adaptiveRecovery from "./adaptiveRecovery.js";

export async function determineRecovery(lastAction, browserState, previousState = null, retryCount = 0) {
  const diagnosis = diagnose(lastAction, browserState, previousState);
  console.log(`[RECOVERY DIAGNOSTIC]
  Failure Type: ${diagnosis.type}
  Details: ${diagnosis.message}
  Hypothesis: ${diagnosis.hypothesis || "None"}
  Retry Count: ${retryCount}`);

  if (diagnosis.escalate) {
    if (retryCount >= 2) {
      return {
        escalate: "human_loop",
        state: "WAITING_FOR_MANUAL_ACTION",
        reason: diagnosis.reason || "Maximum retries reached during recovery execution"
      };
    }
  }

  if (retryCount >= 3) {
    return {
      escalate: "human_loop",
      state: "WAITING_FOR_MANUAL_ACTION",
      reason: "Recovery attempts exhausted."
    };
  }

  // Use adaptive recovery system for intelligent recovery
  const context = {
    pagePurpose: browserState.pagePurpose || "unknown",
    url: browserState.url || "",
    title: browserState.title || "",
    lastAction: lastAction,
    previousState: previousState,
    retryCount: retryCount
  };

  try {
    const adaptiveResult = await adaptiveRecovery.executeRecovery(lastAction, context, retryCount);
    
    if (adaptiveResult && adaptiveResult.success) {
      console.log(`[ADAPTIVE RECOVERY] Successfully recovered using strategy: ${adaptiveResult.strategy}`);
      return adaptiveResult.actions || [];
    } else if (adaptiveResult && !adaptiveResult.success) {
      console.log(`[ADAPTIVE RECOVERY] Adaptive recovery failed: ${adaptiveResult.error || 'unknown error'}`);
      // Fall back to traditional recovery
      return diagnosis.alternative || [
        { type: "refresh", params: {} },
        { type: "read_ui", params: {} }
      ];
    }
  } catch (error) {
    console.error(`[ADAPTIVE RECOVERY] Error during adaptive recovery: ${error.message}`);
    // Fall back to traditional recovery
    return diagnosis.alternative || [
      { type: "refresh", params: {} },
      { type: "read_ui", params: {} }
    ];
  }

  // Fallback to traditional recovery
  return diagnosis.alternative || [
    { type: "refresh", params: {} },
    { type: "read_ui", params: {} }
  ];
}

// Export adaptive recovery functions
export { adaptiveRecovery };
export function setAdaptiveLearning(enabled) {
  adaptiveRecovery.setAdaptiveLearning(enabled);
}
export function getRecoveryStats() {
  return adaptiveRecovery.getRecoveryStats();
}
