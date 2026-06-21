import { verifyState } from "./stateVerifier.js";
import { verifyEvents } from "./eventVerifier.js";
import { verifyGoal } from "./goalVerifier.js";
import { isGoalImpossible } from "./failureVerifier.js";
import { verifyObjective } from "./objectiveVerifier.js";

function getObjective(goal, task) {
  const candidate = task?.objectiveSpec || task?.context?.objective || goal?.currentObjective;
  if (candidate?.desiredState || candidate?.state) return candidate;
  return null;
}

export async function runUnifiedVerification({
  goal,
  task,
  intent,
  observation,
  observations
}) {
  const signals = [];
  let verifiedCount = 0;
  let totalSignals = 0;
  const objective = getObjective(goal, task);

  try {
    const impossibility = await isGoalImpossible({ intent, observations });
    if (impossibility && impossibility.impossible) {
      signals.push({ name: "goal_impossibility", verified: false, score: 0.0, description: "Goal was determined impossible" });
      return { verified: false, confidence: 0.0, signals };
    }
  } catch (e) {
    console.error("[unifiedVerifier] Goal impossibility check failed:", e);
  }

  try {
    const authoritativeMatch = objective ? verifyObjective(objective, observation) : null;
    const stateRes = objective
      ? (authoritativeMatch ? { achieved: true, reason: "Authoritative objective verification succeeded" } : null)
      : verifyState({ task, observation });
    totalSignals++;
    if (stateRes && stateRes.achieved) {
      verifiedCount++;
      signals.push({ name: "state_verification", verified: true, score: 1.0, description: stateRes.reason || "State criteria satisfied" });
    } else {
      signals.push({ name: "state_verification", verified: false, score: 0.0, description: "State criteria not fully satisfied" });
    }
  } catch (e) {
    console.error("[unifiedVerifier] State verification failed:", e);
  }

  try {
    const eventRes = verifyEvents({ task, observation });
    if (eventRes) {
      totalSignals++;
      if (eventRes.achieved) {
        verifiedCount++;
        signals.push({ name: "event_verification", verified: true, score: 1.0, description: "Event matching succeeded" });
      } else {
        signals.push({ name: "event_verification", verified: false, score: 0.0, description: "Event matching failed" });
      }
    }
  } catch (e) {
    console.error("[unifiedVerifier] Event verification failed:", e);
  }

  try {
    const goalRes = await verifyGoal({ goal, task, intent, observation, observations });
    totalSignals++;
    if (goalRes && goalRes.achieved) {
      verifiedCount++;
      signals.push({ name: "goal_verification", verified: true, score: 1.0, description: "Goal conditions met" });
    } else {
      signals.push({ name: "goal_verification", verified: false, score: 0.0, description: "Goal conditions not met" });
    }
  } catch (e) {
    console.error("[unifiedVerifier] Goal verification failed:", e);
  }

  const confidence = totalSignals > 0 ? parseFloat((verifiedCount / totalSignals).toFixed(2)) : 0.0;
  const verified = confidence >= 0.5;

  return {
    verified,
    confidence,
    signals
  };
}
