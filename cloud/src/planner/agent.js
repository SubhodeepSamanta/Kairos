import { createPlan } from "../shared/schemas/plan.js";
import { routeCapability } from "./capabilityRouter.js";
import { determineRecovery, diagnoseFailure } from "./recovery.js";
import { checkForHumanIntervention, saveAgentSession, loadAgentSession } from "./humanLoop.js";
import { llmCallCount, maxLlmCalls } from "../llm/provider.js";
import {
  updateWorldModel,
  recordCompletedTask,
  addFinding
} from "../agent/worldModel.js";
import { extractDataFromPage } from "./extractor.js";
import { isGoalImpossible } from "./failureVerifier.js";
import { verifyByRules } from "./ruleVerifier.js";
import { setIntent, setGoal, setPlan, setObservation } from "../agent/state.js";
import { handleExecutionFailure } from "./strategy.js";

import { parseIntent } from "./intentParser.js";
import { buildObjectives } from "./objectiveBuilder.js";
import { initTracker, updateTracker, recordTransition, recordCapabilityExecution } from "./objectiveTracker.js";
import { verifyObjective } from "./objectiveVerifier.js";
import { resolveCurrentState } from "./currentStateResolver.js";
import { generateTransitions } from "./transitionGenerator.js";
import { createExecutionContext, updateExecutionContext, generateExecutionSummary } from "./executionContext.js";

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

function printMetrics(goal, startTime, startLlmCalls) {
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const llmCallsUsed = llmCallCount - startLlmCalls;
  const metrics = goal.metrics || { skillExecutions: 0, fallbackCount: 0, plannerPromptChars: 0, compressedPromptChars: 0, totalActions: 0, intent_calls: 0, planning_calls: 0, verification_calls: 0 };
  
  console.log(`
===== EXECUTION METRICS =====

Goal:
${goal.objective}

LLM Calls: ${llmCallsUsed}
  - intent_calls: ${metrics.intent_calls || 0}
  - planning_calls: ${metrics.planning_calls || 0}
  - verification_calls: ${metrics.verification_calls || 0}

Actions: ${metrics.totalActions || 0}
Skill Executions: ${metrics.skillExecutions}
Fallbacks: ${metrics.fallbackCount}

Duration: ${durationSec}s
============================
`);
}

export async function runAgent({
    goal,
    executePlan
}) {
  const startTime = Date.now();
  const startLlmCalls = llmCallCount;
  goal.metrics = { 
    skillExecutions: 0, 
    fallbackCount: 0, 
    plannerPromptChars: 0, 
    compressedPromptChars: 0, 
    totalActions: 0,
    intent_calls: 0,
    planning_calls: 0,
    verification_calls: 0
  };

  const wrapExecutePlan = async (plan) => {
    if (plan && plan.actions) {
      goal.metrics.totalActions += plan.actions.length;
    }
    return await executePlan(plan);
  };

  try {
    const res = await _runAgentInternal({ goal, executePlan: wrapExecutePlan });
    printMetrics(goal, startTime, startLlmCalls);
    return res;
  } catch (err) {
    printMetrics(goal, startTime, startLlmCalls);
    throw err;
  }
}

async function _runAgentInternal({
    goal,
    executePlan
}) {
  // Fetch initial browser state before planning
  const initReadPlan = {
    goalId: goal.id,
    actions: [{ type: "read_ui", params: {} }]
  };
  console.log("[AGENT] Fetching initial page state...");
  const initResult = await executePlan(initReadPlan);
  const initObs = initResult?.observations?.[initResult.observations.length - 1];
  if (initObs) {
    updateWorldModel(goal, initObs);
  }

  let latestObs = initObs || goal.world?.history?.[goal.world.history.length - 1]?.observation;
  let browserState = latestObs?.pageState || latestObs || {};

  const preIntentCalls = llmCallCount;
  const intent = await parseIntent(goal.objective);
  goal.metrics.intent_calls = llmCallCount - preIntentCalls;
  goal.intent = intent;
  setIntent(intent);

  console.log("INTENT:", JSON.stringify(intent, null, 2));

  const objectives = buildObjectives(intent);
  goal.objectives = objectives;
  goal.tracker = initTracker(objectives);

  // Initialize/Load Execution Context & Session Persistence
  let context = createExecutionContext(goal);
  const savedSession = loadAgentSession(goal.id);
  if (savedSession) {
    console.log(`[AGENT] Resuming from saved session of type: ${savedSession.stateType}`);
    goal.tracker = savedSession.tracker;
    context = savedSession.context;
  } else {
    for (const obj of objectives) {
      if (obj.openQuestions) {
        context.openQuestions.push(...obj.openQuestions);
      }
    }
  }
  goal.context = context;

  // Check if final desired state is already met
  const finalObj = goal.tracker.objectives[goal.tracker.objectives.length - 1];
  if (verifyObjective(finalObj, browserState)) {
    console.log(`[GOAL COMPLETE] Initial browser state already satisfies the final desired state: ${finalObj.desiredState}. Stopping execution immediately.`);
    const summary = generateExecutionSummary(context, goal.tracker);
    console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    return {
      success: true,
      confidence: 1.0,
      observation: latestObs,
      contextSummary: summary
    };
  }

  let totalActions = 0;
  const MAX_GOAL_ACTIONS = 30;
  goal.blacklistedCapabilities = [];
  
  // Hardened retry and failure records
  const failedTransitions = {}; 
  const transitionRetries = {};
  const objectiveRetries = {};
  let totalGoalRetries = 0;
  let lastResolvedState = null;

  // Track state-transition combinations to detect dead-end states
  const transitionAuditHistory = [];

  while (true) {
    // 1. Resolve current state
    const resolvedCurState = resolveCurrentState(browserState, lastResolvedState);
    lastResolvedState = resolvedCurState;

    // Update Execution Context with the latest observation (only call LLM extraction if we need it)
    if (latestObs) {
      const needsLlmExtraction = (intent.intent === "extract_information" || goal.tracker.objectives.some(o => o.desiredState === "information_extracted"));
      if (needsLlmExtraction) {
        const preUpdateCalls = llmCallCount;
        await updateExecutionContext(context, latestObs, resolvedCurState);
        goal.metrics.planning_calls += (llmCallCount - preUpdateCalls);
      } else {
        const pageUrl = latestObs.pageState?.url || latestObs.url;
        const pageTitle = latestObs.pageState?.title || latestObs.title;
        if (pageUrl && !context.visitedPages.some(p => p.url === pageUrl)) {
          context.visitedPages.push({
            url: pageUrl,
            title: pageTitle || "",
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // 2. Check for human intervention
    const intervention = checkForHumanIntervention(browserState);
    if (intervention) {
      console.log(`[HUMAN_INTERVENTION] State: ${intervention.state}, Reason: ${intervention.reason}`);
      const summary = generateExecutionSummary(context, goal.tracker);
      saveAgentSession(goal, goal.tracker, context, intervention.state);
      return {
        success: false,
        reason: intervention.state,
        observation: latestObs,
        contextSummary: summary
      };
    }

    // 3. Early exit if all open questions are resolved (knowledge-based goal completion)
    const hasQuestions = context.completedQuestions.length > 0 || context.openQuestions.length > 0;
    const allQuestionsResolved = hasQuestions && context.openQuestions.length === 0;
    if (allQuestionsResolved) {
      console.log("[GOAL COMPLETE] Early exit: All execution-context open questions have been successfully answered.");
      while (goal.tracker.currentIndex < goal.tracker.objectives.length) {
        updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
      }
      const summary = generateExecutionSummary(context, goal.tracker);
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
      return {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      };
    }

    // 4. Skip any objectives already achieved by browser state
    while (goal.tracker.currentIndex < goal.tracker.objectives.length) {
      const currentObj = goal.tracker.objectives[goal.tracker.currentIndex];
      if (verifyObjective(currentObj, browserState)) {
        updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
        console.log(`[OBJECTIVE] Achieved via state: ${currentObj.desiredState}`);
      } else {
        break;
      }
    }

    // 5. Goal complete check (state-based)
    if (goal.tracker.currentIndex >= goal.tracker.objectives.length) {
      console.log("[GOAL COMPLETE] All objectives met.");
      const summary = generateExecutionSummary(context, goal.tracker);
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
      return {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      };
    }

    const currentObj = goal.tracker.objectives[goal.tracker.currentIndex];
    context.currentObjective = currentObj;

    // 6. Early objective completion check (knowledge-based objective completion)
    if (currentObj.openQuestions && currentObj.openQuestions.length > 0) {
      const objQuestionsResolved = currentObj.openQuestions.every(q => 
        context.completedQuestions.some(cq => cq.question === q)
      );
      if (objQuestionsResolved) {
        console.log(`[OBJECTIVE COMPLETE] Early exit: All information gaps for objective "${currentObj.desiredState}" resolved.`);
        updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
        continue;
      }
    }

    updateTracker(goal.tracker, goal.tracker.currentIndex, "in_progress");

    // 7. Generate transitions
    const transitions = generateTransitions(resolvedCurState, currentObj, failedTransitions);
    if (transitions.length === 0) {
      console.log("[AGENT] No transitions generated. Target might be reached.");
      const summary = generateExecutionSummary(context, goal.tracker);
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
      return {
        success: true,
        confidence: 0.9,
        observation: latestObs,
        contextSummary: summary
      };
    }

    const activeTransition = transitions[0];

    console.log(`
=========================================
CURRENT STATE: ${resolvedCurState.platform}_${resolvedCurState.currentState} (query="${resolvedCurState.parameters.query || ""}")
DESIRED STATE: ${currentObj.platform}_${currentObj.desiredState} (query="${currentObj.parameters.query || ""}")
TRANSITIONS: ${transitions.map(t => `${t.id} (${t.score.toFixed(2)})`).join(", ")}
ACTIVE TRANSITION: ${activeTransition.id} (confidence: ${activeTransition.confidence})
=========================================
`);
    console.log("[TRANSITION]", activeTransition);

    // 8. Action limits check
    if (totalActions > MAX_GOAL_ACTIONS) {
      console.log(`[BUDGET] Goal exceeded max actions of ${MAX_GOAL_ACTIONS}`);
      const summary = generateExecutionSummary(context, goal.tracker);
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
      return {
        success: false,
        reason: "goal_action_budget_exceeded",
        observation: latestObs,
        contextSummary: summary
      };
    }

    // 9. Route to Capability
    const capability = routeCapability(activeTransition, goal.blacklistedCapabilities);
    let plan = null;
    let executeSuccess = false;

    console.log("[CAPABILITY]", capability ? capability.name : "None");

    console.log(`[CAPABILITY DIAGNOSTIC]
  Transition: ${activeTransition.id}
  Selected Capability: ${capability ? capability.name : "None"}
  Capability Input (desiredState): ${activeTransition.desiredState}
  Capability Input (parameters): ${JSON.stringify(activeTransition.parameters)}`);

    if (capability) {
      console.log("DEBUG BROWSER STATE KEYS:", Object.keys(browserState));
      console.log("DEBUG BROWSER STATE INPUTS:", browserState.inputs);
      capability.executions++;
      const capabilityResult = capability.execute(activeTransition, browserState) || { success: false, reason: "No response from capability execute" };
      
      console.log("[ACTIONS]", capabilityResult.actions || []);
      console.log(`[CAPABILITY DIAGNOSTIC] Capability Output:`, JSON.stringify(capabilityResult, null, 2));

      if (capabilityResult.success && capabilityResult.actions && capabilityResult.actions.length > 0) {
        plan = createPlan(goal.id, capabilityResult.actions);
      } else {
        console.warn(`[CAPABILITY FAILURE] Capability matched but returned invalid execution plan. Reason: ${capabilityResult.reason || "Empty actions or success=false"}`);
        
        // Treat as failure directly, record metrics
        recordCapabilityExecution(goal.tracker, capability.name, "failure", 0);
        capability.failures++;
        capability.successRate = capability.successes / capability.executions;

        const failure = { 
          type: "element_missing", 
          message: `Capability "${capability.name}" failed to generate plan: ${capabilityResult.reason || "empty actions"}`, 
          browserState 
        };
        console.log("[RECOVERY]", failure.message);
        goal.tracker.lastFailure = failure.message;
        goal.tracker.attemptCount++;

        const transitionId = activeTransition.id;
        transitionRetries[transitionId] = (transitionRetries[transitionId] || 0) + 1;
        objectiveRetries[currentObj.id] = (objectiveRetries[currentObj.id] || 0) + 1;
        totalGoalRetries++;

        // Verify limits
        if (totalGoalRetries >= 10 || objectiveRetries[currentObj.id] >= 5) {
          console.log(`[LIMITS EXCEEDED] Goal retries: ${totalGoalRetries}/10, Objective retries: ${objectiveRetries[currentObj.id]}/5. Requiring manual intervention.`);
          const summary = generateExecutionSummary(context, goal.tracker);
          saveAgentSession(goal, goal.tracker, context, "WAITING_FOR_MANUAL_ACTION", activeTransition);
          return {
            success: false,
            reason: "WAITING_FOR_MANUAL_ACTION",
            observation: latestObs,
            contextSummary: summary
          };
        }

        // Recovery / Escalation
        const escalationRetryCount = transitionRetries[transitionId] - 1;
        const recoveryResult = determineRecovery(failure, activeTransition, capability, escalationRetryCount);
        if (recoveryResult && recoveryResult.escalate) {
          if (recoveryResult.escalate === "alternative_capability") {
            console.log(`[RECOVERY ESCALATION] Blacklisting capability: ${capability.name}`);
            goal.blacklistedCapabilities.push(capability.name);
          } else if (recoveryResult.escalate === "alternative_transition") {
            console.log(`[RECOVERY ESCALATION] Blacklisting transition: ${transitionId}`);
            failedTransitions[transitionId] = (failedTransitions[transitionId] || 0) + 1;
          } else if (recoveryResult.escalate === "human_loop") {
            console.log(`[RECOVERY ESCALATION] Pausing execution. Escalating to state: ${recoveryResult.state}`);
            const summary = generateExecutionSummary(context, goal.tracker);
            saveAgentSession(goal, goal.tracker, context, recoveryResult.state, activeTransition);
            return {
              success: false,
              reason: recoveryResult.state,
              observation: latestObs,
              contextSummary: summary
            };
          }
        } else if (recoveryResult && Array.isArray(recoveryResult)) {
          console.log(`[RECOVERY] Executing simple recovery actions for failure: ${failure.type}`);
          const recPlan = createPlan(goal.id, recoveryResult);
          const recResult = await executePlan(recPlan);
          const recObs = recResult.observations || [];
          latestObs = getLatestObservation(recObs, latestObs);
          browserState = latestObs?.pageState || latestObs || {};
          totalActions += recPlan.actions.length;
          updateWorldModel(goal, latestObs);
        }
      }
    }

    if (plan) {
      setPlan(plan);
      console.log("EXECUTING PLAN:", JSON.stringify(plan, null, 2));

      const result = await executePlan(plan);
      console.log("EXECUTE RESULT:", JSON.stringify(result, null, 2));

      const observations = result.observations || [];
      latestObs = getLatestObservation(observations, latestObs);
      browserState = latestObs?.pageState || latestObs || {};

      totalActions += plan.actions.length;
      setObservation(latestObs);
      updateWorldModel(goal, latestObs);
      const resolvedNextState = resolveCurrentState(browserState, lastResolvedState);
      lastResolvedState = resolvedNextState;
      recordTransition(goal.tracker, activeTransition, resolvedCurState, resolvedNextState);

      // STEP 5 — Capability Verification
      const targetVerified = capability.verify(activeTransition, latestObs);
      console.log("[VERIFY RESULT]", targetVerified);
      console.log(`[VERIFICATION] transition: ${activeTransition.id}, verified: ${targetVerified}`);

      const env = resolvedCurState.environment || "generic";
      if (capability) {
        if (!capability.success_by_environment) {
          capability.success_by_environment = {};
        }
        if (!capability.success_by_environment[env]) {
          capability.success_by_environment[env] = { executions: 0, successes: 0, successRate: 1.0 };
        }
        capability.success_by_environment[env].executions++;
      }

      if (targetVerified) {
        console.log(`[VERIFICATION] Target state verified successfully for transition: ${activeTransition.id}`);
        recordCapabilityExecution(goal.tracker, capability.name, "success");
        if (capability) {
          capability.successes++;
          capability.successRate = capability.successes / capability.executions;
          capability.success_by_environment[env].successes++;
          capability.success_by_environment[env].successRate = 
            capability.success_by_environment[env].successes / capability.success_by_environment[env].executions;
        }
        executeSuccess = true;
      } else {
        console.log(`[VERIFICATION] Target state verification failed for transition: ${activeTransition.id}`);
        
        // Re-resolve state using latest browserState
        const finalCheckState = resolveCurrentState(browserState, lastResolvedState);
        if (verifyObjective(currentObj, finalCheckState)) {
          console.log(`[RECOVERY BYPASS] Re-resolved state satisfies active objective "${currentObj.desiredState}". Skipping recovery.`);
          updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
          executeSuccess = true;
          
          if (capability) {
            capability.successes++;
            capability.successRate = capability.successes / capability.executions;
            capability.success_by_environment[env].successes++;
            capability.success_by_environment[env].successRate = 
              capability.success_by_environment[env].successes / capability.success_by_environment[env].executions;
          }
          recordCapabilityExecution(goal.tracker, capability.name, "success");
          continue; // Bypass recovery loop entirely
        }

        recordCapabilityExecution(goal.tracker, capability.name, "failure", 0);
        if (capability) {
          capability.failures++;
          capability.successRate = capability.successes / capability.executions;
          capability.success_by_environment[env].successRate = 
            capability.success_by_environment[env].successes / capability.success_by_environment[env].executions;
        }

        const failure = diagnoseFailure(activeTransition, browserState, result);
        console.log("[RECOVERY]", failure.message);
        goal.tracker.lastFailure = failure.message;
        goal.tracker.attemptCount++;

        // Increment retry and check limits
        const transitionId = activeTransition.id;
        transitionRetries[transitionId] = (transitionRetries[transitionId] || 0) + 1;
        objectiveRetries[currentObj.id] = (objectiveRetries[currentObj.id] || 0) + 1;
        totalGoalRetries++;

        // Verify limits: max retries per transition (3), per objective (5), per goal (10)
        if (totalGoalRetries >= 10 || objectiveRetries[currentObj.id] >= 5) {
          console.log(`[LIMITS EXCEEDED] Goal retries: ${totalGoalRetries}/10, Objective retries: ${objectiveRetries[currentObj.id]}/5. Requiring manual intervention.`);
          const summary = generateExecutionSummary(context, goal.tracker);
          saveAgentSession(goal, goal.tracker, context, "WAITING_FOR_MANUAL_ACTION", activeTransition);
          return {
            success: false,
            reason: "WAITING_FOR_MANUAL_ACTION",
            observation: latestObs,
            contextSummary: summary
          };
        }

        // Dead-end detection (same state, same transition, same failure 3 times)
        const auditKey = `${resolvedCurState.platform}_${resolvedCurState.currentState}_${transitionId}_${failure.type}`;
        transitionAuditHistory.push(auditKey);
        const lastThreeStuck = transitionAuditHistory.slice(-3).every(x => x === auditKey) && transitionAuditHistory.length >= 3;
        
        let escalationRetryCount = transitionRetries[transitionId] - 1;
        if (lastThreeStuck) {
          console.log(`[DEAD-END DETECTED] Same state, transition, and failure type hit 3 times. Forcing escalation.`);
          escalationRetryCount = 3; // Forces human loop escalation
        }

        // Check for human intervention post-failure
        const postFailIntervention = checkForHumanIntervention(browserState);
        if (postFailIntervention) {
          console.log(`[HUMAN_INTERVENTION] Post-failure state: ${postFailIntervention.state}, Reason: ${postFailIntervention.reason}`);
          const summary = generateExecutionSummary(context, goal.tracker);
          saveAgentSession(goal, goal.tracker, context, postFailIntervention.state, activeTransition);
          return {
            success: false,
            reason: postFailIntervention.state,
            observation: latestObs,
            contextSummary: summary
          };
        }

        // Escalation Recovery Model
        const recoveryResult = determineRecovery(failure, activeTransition, capability, escalationRetryCount);
        if (recoveryResult && recoveryResult.escalate) {
          if (recoveryResult.escalate === "alternative_capability") {
            console.log(`[RECOVERY ESCALATION] Blacklisting capability: ${capability.name}`);
            goal.blacklistedCapabilities.push(capability.name);
          } else if (recoveryResult.escalate === "alternative_transition") {
            console.log(`[RECOVERY ESCALATION] Blacklisting transition: ${transitionId}`);
            failedTransitions[transitionId] = (failedTransitions[transitionId] || 0) + 1;
          } else if (recoveryResult.escalate === "human_loop") {
            console.log(`[RECOVERY ESCALATION] Pausing execution. Escalating to state: ${recoveryResult.state}`);
            const summary = generateExecutionSummary(context, goal.tracker);
            saveAgentSession(goal, goal.tracker, context, recoveryResult.state, activeTransition);
            return {
              success: false,
              reason: recoveryResult.state,
              observation: latestObs,
              contextSummary: summary
            };
          }
        } else if (recoveryResult && Array.isArray(recoveryResult)) {
          console.log(`[RECOVERY] Executing simple recovery actions for failure: ${failure.type}`);
          const recPlan = createPlan(goal.id, recoveryResult);
          const recResult = await executePlan(recPlan);
          const recObs = recResult.observations || [];
          latestObs = getLatestObservation(recObs, latestObs);
          browserState = latestObs?.pageState || latestObs || {};
          totalActions += recPlan.actions.length;
          updateWorldModel(goal, latestObs);

          // Re-verify target state
          const postRecoveryVerified = capability.verify(activeTransition, latestObs);
          if (postRecoveryVerified) {
            console.log("[RECOVERY] Target state verified after recovery.");
            executeSuccess = true;
          } else {
            console.log("[RECOVERY] Target state verification still failed after recovery.");
          }
        }
      }
    } else {
      console.log("[AGENT] No capability matched or no execution plan generated. Attempting recovery...");
      const failure = { type: "element_missing", message: "No capability matched transition", browserState };
      const recoveryActions = determineRecovery(failure, activeTransition, null, 0);
      if (recoveryActions && Array.isArray(recoveryActions)) {
        const recPlan = createPlan(goal.id, recoveryActions);
        const recResult = await executePlan(recPlan);
        const recObs = recResult.observations || [];
        latestObs = getLatestObservation(recObs, latestObs);
        browserState = latestObs?.pageState || latestObs || {};
        totalActions += recPlan.actions.length;
        updateWorldModel(goal, latestObs);
      } else {
        console.log("[AGENT] Recovery failed to generate actions.");
        const summary = generateExecutionSummary(context, goal.tracker);
        return {
          success: false,
          reason: "no_plan_or_recovery",
          observation: latestObs,
          contextSummary: summary
        };
      }
    }

    if (activeTransition.desiredState === "information_extracted" && latestObs?.success) {
      const pageText = browserState.text || "";
      const queryText = activeTransition.parameters?.query || "";
      const sourceUrl = browserState.url || "";
      const sourceTitle = browserState.title || "";
      
      console.log(`[EXTRACT] Extracting data for query: "${queryText}"...`);
      const extractedData = await extractDataFromPage(pageText, queryText);
      
      addFinding(goal, {
        query: queryText,
        data: extractedData,
        source: { url: sourceUrl, title: sourceTitle }
      });
      console.log(`[EXTRACT] Finding added to world model:`, JSON.stringify(extractedData));
    }
  }
}