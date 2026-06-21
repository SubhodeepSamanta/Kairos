import { diagnose } from "./diagnoser.js";

export function determineRecovery(lastAction, browserState, previousState = null, retryCount = 0) {
  const diagnosis = diagnose(lastAction, browserState, previousState);
  console.log(`[RECOVERY DIAGNOSTIC]
  Failure Type: ${diagnosis.type}
  Details: ${diagnosis.message}
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

  return diagnosis.alternative || [
    { type: "refresh", params: {} },
    { type: "read_ui", params: {} }
  ];
}
