import { determineRecovery, diagnoseFailure } from "../recovery/recovery.js";
import { checkForHumanIntervention, saveAgentSession } from "../state/agentSession.js";
import { checkDeadEnd } from "../state/agentState.js";
import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { verifyObjective } from "../../verification/objectiveVerifier.js";
import { recordTransition, recordCapabilityExecution, updateTracker } from "../../reasoning/objectiveTracker.js";
import { updateWorldModel } from "../../world/worldModel.js";
import { setObservation } from "../state/state.js";
import { createPlan } from "../../shared/schemas/plan.js";
import { generateExecutionSummary } from "../../world/executionContext.js";

function getLatestObservation(observations, fallbackObs) {
  if (!observations || observations.length === 0) return fallbackObs;
  const failedObservation = observations.find(obs => !obs.success);
  let latest = failedObservation || observations[observations.length - 1];
  
  const obsWithPageState = [...observations].reverse().find(obs => obs?.pageState);
  if (latest && !latest.pageState && obsWithPageState?.pageState) {
    latest = { ...latest, pageState: obsWithPageState.pageState };
  }
  return latest;
}

export async function handleCapabilityFailure({
  goal,
  activeTransition,
  currentObj,
  browserState,
  latestObs,
  context,
  transitionRetries,
  objectiveRetries,
  totalGoalRetries,
  failedTransitions,
  executePlan,
  totalActions,
  capability
}) {
  console.warn(`[CAPABILITY FAILURE] Capability matched but returned invalid execution plan.`);
  
  recordCapabilityExecution(goal.tracker, capability.name, "failure", 0);
  capability.failures++;
  capability.successRate = capability.successes / capability.executions;

  const failure = { 
    type: "element_missing", 
    message: `Capability "${capability.name}" failed to generate plan: empty actions`, 
    browserState 
  };
  console.log("[RECOVERY]", failure.message);
  goal.tracker.lastFailure = failure.message;
  goal.tracker.attemptCount++;

  const transitionId = activeTransition.id;
  transitionRetries[transitionId] = (transitionRetries[transitionId] || 0) + 1;
  objectiveRetries[currentObj.id] = (objectiveRetries[currentObj.id] || 0) + 1;
  totalGoalRetries.val++;

  if (totalGoalRetries.val >= 10 || objectiveRetries[currentObj.id] >= 5) {
    console.log(`[LIMITS EXCEEDED] Goal retries: ${totalGoalRetries.val}/10, Objective retries: ${objectiveRetries[currentObj.id]}/5. Requiring manual intervention.`);
    const summary = generateExecutionSummary(context, goal.tracker);
    saveAgentSession(goal, goal.tracker, context, "WAITING_FOR_MANUAL_ACTION", activeTransition);
    return {
      shouldExit: true,
      exitValue: {
        success: false,
        reason: "WAITING_FOR_MANUAL_ACTION",
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  const escalationRetryCount = transitionRetries[transitionId] - 1;
  const recoveryResult = determineRecovery(failure, activeTransition, capability, escalationRetryCount);
  if (recoveryResult && recoveryResult.escalate) {
    if (recoveryResult.escalate === "alternative_capability") {
      const failureCount = transitionRetries[transitionId] || 0;
      if (failureCount >= 3 && capability.name !== "ResultCapability" && capability.name !== "SelectionCapability") {
        console.log(`[RECOVERY ESCALATION] Blacklisting capability: ${capability.name}`);
        goal.blacklistedCapabilities.push(capability.name);
      } else {
        console.log(`[RECOVERY ESCALATION] Skipping blacklisting for capability: ${capability.name} (failureCount: ${failureCount})`);
      }
    } else if (recoveryResult.escalate === "alternative_transition") {
      console.log(`[RECOVERY ESCALATION] Blacklisting transition: ${transitionId}`);
      failedTransitions[transitionId] = (failedTransitions[transitionId] || 0) + 1;
    } else if (recoveryResult.escalate === "human_loop") {
      console.log(`[RECOVERY ESCALATION] Pausing execution. Escalating to state: ${recoveryResult.state}`);
      const summary = generateExecutionSummary(context, goal.tracker);
      saveAgentSession(goal, goal.tracker, context, recoveryResult.state, activeTransition);
      return {
        shouldExit: true,
        exitValue: {
          success: false,
          reason: recoveryResult.state,
          observation: latestObs,
          contextSummary: summary
        }
      };
    }
  } else if (recoveryResult && Array.isArray(recoveryResult)) {
    console.log(`[RECOVERY] Executing simple recovery actions for failure: ${failure.type}`);
    const recPlan = createPlan(goal.id, recoveryResult);
    const recResult = await executePlan(recPlan);
    const recObs = recResult.observations || [];
    latestObs = getLatestObservation(recObs, latestObs);
    browserState = latestObs?.pageState || latestObs || {};
    totalActions.val += recPlan.actions.length;
    updateWorldModel(goal, latestObs);
  }

  return { shouldExit: false, latestObs, browserState };
}

export async function executeAndVerify({
  goal,
  activeTransition,
  currentObj,
  browserState,
  latestObs,
  context,
  plan,
  capability,
  executePlan,
  totalActions,
  lastResolvedState,
  resolvedCurState,
  transitionAuditHistory,
  transitionRetries,
  objectiveRetries,
  totalGoalRetries,
  failedTransitions
}) {
  console.log("EXECUTING PLAN:", JSON.stringify(plan, null, 2));

  const result = await executePlan(plan);
  console.log("EXECUTE RESULT:", JSON.stringify(result, null, 2));

  const observations = result.observations || [];
  latestObs = getLatestObservation(observations, latestObs);
  browserState = latestObs?.pageState || latestObs || {};

  totalActions.val += plan.actions.length;
  setObservation(latestObs);
  updateWorldModel(goal, latestObs);
  const resolvedNextState = resolveCurrentState(browserState, lastResolvedState.val);
  lastResolvedState.val = resolvedNextState;
  recordTransition(goal.tracker, activeTransition, resolvedCurState, resolvedNextState);

  const targetVerified = capability.verify(activeTransition, latestObs);
  console.log("[VERIFY RESULT]", targetVerified);
  console.log(`[VERIFICATION] transition: ${activeTransition.id}, verified: ${targetVerified}`);

  const env = resolvedCurState.environment || "generic";
  if (!capability.success_by_environment) {
    capability.success_by_environment = {};
  }
  if (!capability.success_by_environment[env]) {
    capability.success_by_environment[env] = { executions: 0, successes: 0, successRate: 1.0 };
  }
  capability.success_by_environment[env].executions++;

  if (targetVerified) {
    console.log(`[VERIFICATION] Target state verified successfully for transition: ${activeTransition.id}`);
    recordCapabilityExecution(goal.tracker, capability.name, "success");
    capability.successes++;
    capability.successRate = capability.successes / capability.executions;
    capability.success_by_environment[env].successes++;
    capability.success_by_environment[env].successRate = 
      capability.success_by_environment[env].successes / capability.success_by_environment[env].executions;
  } else {
    console.log(`[VERIFICATION] Target state verification failed for transition: ${activeTransition.id}`);
    
    const finalCheckState = resolveCurrentState(browserState, lastResolvedState.val);
    if (verifyObjective(currentObj, finalCheckState)) {
      console.log(`[RECOVERY BYPASS] Re-resolved state satisfies active objective "${currentObj.desiredState}". Skipping recovery.`);
      updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
      
      capability.successes++;
      capability.successRate = capability.successes / capability.executions;
      capability.success_by_environment[env].successes++;
      capability.success_by_environment[env].successRate = 
        capability.success_by_environment[env].successes / capability.success_by_environment[env].executions;
      recordCapabilityExecution(goal.tracker, capability.name, "success");
      return { shouldContinue: true, latestObs, browserState };
    }

    recordCapabilityExecution(goal.tracker, capability.name, "failure", 0);
    capability.failures++;
    capability.successRate = capability.successes / capability.executions;
    capability.success_by_environment[env].successRate = 
      capability.success_by_environment[env].successes / capability.success_by_environment[env].executions;

    const failure = diagnoseFailure(activeTransition, browserState, result);

    console.log("[RECOVERY TRIGGER]");
    console.log(JSON.stringify({
      objective: currentObj,
      currentState: resolvedCurState,
      verificationResult: { targetVerified },
      failedTransition: activeTransition
    }, null, 2));

    console.log("[RECOVERY]", failure.message);
    goal.tracker.lastFailure = failure.message;
    goal.tracker.attemptCount++;

    const transitionId = activeTransition.id;
    transitionRetries[transitionId] = (transitionRetries[transitionId] || 0) + 1;
    objectiveRetries[currentObj.id] = (objectiveRetries[currentObj.id] || 0) + 1;
    totalGoalRetries.val++;

    if (totalGoalRetries.val >= 10 || objectiveRetries[currentObj.id] >= 5) {
      console.log(`[LIMITS EXCEEDED] Goal retries: ${totalGoalRetries.val}/10, Objective retries: ${objectiveRetries[currentObj.id]}/5. Requiring manual intervention.`);
      const summary = generateExecutionSummary(context, goal.tracker);
      saveAgentSession(goal, goal.tracker, context, "WAITING_FOR_MANUAL_ACTION", activeTransition);
      return {
        shouldExit: true,
        exitValue: {
          success: false,
          reason: "WAITING_FOR_MANUAL_ACTION",
          observation: latestObs,
          contextSummary: summary
        }
      };
    }

    const lastThreeStuck = checkDeadEnd(transitionAuditHistory, resolvedCurState, transitionId, failure);
    
    let escalationRetryCount = transitionRetries[transitionId] - 1;
    if (lastThreeStuck) {
      console.log(`[DEAD-END DETECTED] Same state, transition, and failure type hit 3 times. Forcing escalation.`);
      escalationRetryCount = 3;
    }

    const postFailIntervention = checkForHumanIntervention(browserState);
    if (postFailIntervention) {
      console.log(`[HUMAN_INTERVENTION] Post-failure state: ${postFailIntervention.state}, Reason: ${postFailIntervention.reason}`);
      const summary = generateExecutionSummary(context, goal.tracker);
      saveAgentSession(goal, goal.tracker, context, postFailIntervention.state, activeTransition);
      return {
        shouldExit: true,
        exitValue: {
          success: false,
          reason: postFailIntervention.state,
          observation: latestObs,
          contextSummary: summary
        }
      };
    }

    const recoveryResult = determineRecovery(failure, activeTransition, capability, escalationRetryCount);
    if (recoveryResult && recoveryResult.escalate) {
      if (recoveryResult.escalate === "alternative_capability") {
        const failureCount = transitionRetries[transitionId] || 0;
        if (failureCount >= 3 && capability.name !== "ResultCapability" && capability.name !== "SelectionCapability") {
          console.log(`[RECOVERY ESCALATION] Blacklisting capability: ${capability.name}`);
          goal.blacklistedCapabilities.push(capability.name);
        } else {
          console.log(`[RECOVERY ESCALATION] Skipping blacklisting for capability: ${capability.name} (failureCount: ${failureCount})`);
        }
      } else if (recoveryResult.escalate === "alternative_transition") {
        console.log(`[RECOVERY ESCALATION] Blacklisting transition: ${transitionId}`);
        failedTransitions[transitionId] = (failedTransitions[transitionId] || 0) + 1;
      } else if (recoveryResult.escalate === "human_loop") {
        console.log(`[RECOVERY ESCALATION] Pausing execution. Escalating to state: ${recoveryResult.state}`);
        const summary = generateExecutionSummary(context, goal.tracker);
        saveAgentSession(goal, goal.tracker, context, recoveryResult.state, activeTransition);
        return {
          shouldExit: true,
          exitValue: {
            success: false,
            reason: recoveryResult.state,
            observation: latestObs,
            contextSummary: summary
          }
        };
      }
    } else if (recoveryResult && Array.isArray(recoveryResult)) {
      console.log(`[RECOVERY] Executing simple recovery actions for failure: ${failure.type}`);
      const recPlan = createPlan(goal.id, recoveryResult);
      const recResult = await executePlan(recPlan);
      const recObs = recResult.observations || [];
      latestObs = getLatestObservation(recObs, latestObs);
      browserState = latestObs?.pageState || latestObs || {};
      totalActions.val += recPlan.actions.length;
      updateWorldModel(goal, latestObs);

      const postRecoveryVerified = capability.verify(activeTransition, latestObs);
      if (postRecoveryVerified) {
        console.log("[RECOVERY] Target state verified after recovery.");
      } else {
        console.log("[RECOVERY] Target state verification still failed after recovery.");
      }
    }
  }

  return { shouldExit: false, latestObs, browserState };
}

export async function handleNoCapabilityMatched({
  goal,
  activeTransition,
  browserState,
  latestObs,
  executePlan,
  totalActions
}) {
  console.log("[AGENT] No capability matched or no execution plan generated. Attempting recovery...");
  const failure = { type: "element_missing", message: "No capability matched transition", browserState };
  const recoveryActions = determineRecovery(failure, activeTransition, null, 0);
  if (recoveryActions && Array.isArray(recoveryActions)) {
    const recPlan = createPlan(goal.id, recoveryActions);
    const recResult = await executePlan(recPlan);
    const recObs = recResult.observations || [];
    latestObs = getLatestObservation(recObs, latestObs);
    browserState = latestObs?.pageState || latestObs || {};
    totalActions.val += recPlan.actions.length;
    updateWorldModel(goal, latestObs);
    return { shouldContinue: true, latestObs, browserState };
  } else {
    console.log("[AGENT] Recovery failed to generate actions.");
    const summary = generateExecutionSummary(goal.context, goal.tracker);
    return {
      shouldExit: true,
      exitValue: {
        success: false,
        reason: "no_plan_or_recovery",
        observation: latestObs,
        contextSummary: summary
      }
    };
  }
}
