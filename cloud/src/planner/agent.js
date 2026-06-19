import { createPlan } from "../shared/schemas/plan.js";
import { routeCapability } from "./capabilityRouter.js";
import { determineRecovery, diagnoseFailure } from "./recovery.js";
import { checkForHumanIntervention } from "./humanLoop.js";
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
import { verifyState } from "./stateVerifier.js";
import { verifyEvents } from "./eventVerifier.js";
import { TASK_STATUS } from "../shared/schemas/task.js";
import { handleExecutionFailure } from "./strategy.js";

import { parseIntent } from "./intentParser.js";
import { buildObjectives } from "./objectiveBuilder.js";
import { initTracker, updateTracker, recordTransition, recordCapabilityExecution } from "./objectiveTracker.js";
import { verifyObjective } from "./objectiveVerifier.js";
import { resolveCurrentState } from "./currentStateResolver.js";
import { generateTransitions } from "./transitionGenerator.js";
import { createExecutionContext, updateExecutionContext, generateExecutionSummary } from "./executionContext.js";

function printMetrics(goal, startTime, startLlmCalls) {
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const llmCallsUsed = llmCallCount - startLlmCalls;
  const metrics = goal.metrics || { skillExecutions: 0, fallbackCount: 0, plannerPromptChars: 0, compressedPromptChars: 0, totalActions: 0 };
  
  console.log(`
===== EXECUTION METRICS =====

Goal:
${goal.objective}

LLM Calls: ${llmCallsUsed}
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
  goal.metrics = { skillExecutions: 0, fallbackCount: 0, plannerPromptChars: 0, compressedPromptChars: 0, totalActions: 0 };

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

  let latestObs = goal.world?.history?.[goal.world.history.length - 1]?.observation;
  let browserState = latestObs?.pageState || latestObs || {};

  const intent = await parseIntent(goal.objective);
  goal.intent = intent;
  setIntent(intent);

  console.log("INTENT:", JSON.stringify(intent, null, 2));

  const objectives = buildObjectives(intent);
  goal.objectives = objectives;
  goal.tracker = initTracker(objectives);

  // Initialize Execution Context
  const context = createExecutionContext(goal);
  for (const obj of objectives) {
    if (obj.openQuestions) {
      context.openQuestions.push(...obj.openQuestions);
    }
  }
  goal.context = context;

  // Check if final desired state is already met
  const finalObj = goal.tracker.objectives[goal.tracker.objectives.length - 1];
  if (verifyObjective(finalObj, browserState)) {
    console.log(`[GOAL COMPLETE] Initial browser state already satisfies the final desired state: ${finalObj.desiredState}. Stopping execution immediately.`);
    const summary = generateExecutionSummary(context);
    console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    return {
      success: true,
      observation: latestObs,
      contextSummary: summary
    };
  }

  let totalActions = 0;
  const MAX_GOAL_ACTIONS = 30;
  goal.blacklistedCapabilities = [];
  const transitionAttempts = {}; // Tracks retry count per transition to prevent infinite recovery loops

  while (true) {
    // 1. Resolve current state
    const resolvedCurState = resolveCurrentState(browserState);

    // Update Execution Context with the latest observation
    if (latestObs) {
      await updateExecutionContext(context, latestObs, resolvedCurState);
    }

    // 2. Check for human intervention
    const intervention = checkForHumanIntervention(browserState);
    if (intervention) {
      console.log(`[HUMAN_INTERVENTION] State: ${intervention.state}, Reason: ${intervention.reason}`);
      const summary = generateExecutionSummary(context);
      console.log("EXECUTION SUMMARY (PAUSED):", JSON.stringify(summary, null, 2));
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
      const summary = generateExecutionSummary(context);
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
      return {
        success: true,
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
      const summary = generateExecutionSummary(context);
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
      return {
        success: true,
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
    const transitions = generateTransitions(resolvedCurState, currentObj);
    if (transitions.length === 0) {
      console.log("[AGENT] No transitions generated. Target might be reached.");
      const summary = generateExecutionSummary(context);
      console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
      return {
        success: true,
        observation: latestObs,
        contextSummary: summary
      };
    }

    const activeTransition = transitions[0];

    console.log(`
=========================================
CURRENT STATE: ${resolvedCurState.platform}_${resolvedCurState.currentState} (query="${resolvedCurState.parameters.query || ""}")
DESIRED STATE: ${currentObj.platform}_${currentObj.desiredState} (query="${currentObj.parameters.query || ""}")
TRANSITIONS: ${transitions.map(t => t.id).join(", ")}
ACTIVE TRANSITION: ${activeTransition.id}
=========================================
`);

    // 8. Action limits check
    if (totalActions > MAX_GOAL_ACTIONS) {
      console.log(`[BUDGET] Goal exceeded max actions of ${MAX_GOAL_ACTIONS}`);
      const summary = generateExecutionSummary(context);
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

    if (capability) {
      const actions = capability.execute(activeTransition, browserState);
      if (actions && actions.length > 0) {
        plan = createPlan(goal.id, actions);
      }
    }
    
    let executeSuccess = false;
    let recoveryCount = 0;

    if (plan) {
      setPlan(plan);
      console.log("EXECUTING PLAN:", JSON.stringify(plan, null, 2));

      const result = await executePlan(plan);
      console.log("EXECUTE RESULT:", JSON.stringify(result, null, 2));

      const observations = result.observations || [];
      const failedObservation = observations.find(obs => !obs.success);
      latestObs = failedObservation || observations[observations.length - 1];
      browserState = latestObs?.pageState || latestObs || {};

      totalActions += plan.actions.length;
      setObservation(latestObs);
      updateWorldModel(goal, latestObs);

      const resolvedNextState = resolveCurrentState(browserState);
      recordTransition(goal.tracker, activeTransition, resolvedCurState, resolvedNextState);

      // Verify target state
      const targetVerified = capability.verify(activeTransition, latestObs);
      if (targetVerified) {
        console.log(`[VERIFICATION] Target state verified successfully for transition: ${activeTransition.id}`);
        recordCapabilityExecution(goal.tracker, capability.name, "success");
        executeSuccess = true;
      } else {
        console.log(`[VERIFICATION] Target state verification failed for transition: ${activeTransition.id}`);
        recordCapabilityExecution(goal.tracker, capability.name, "failure", 0);

        const failure = diagnoseFailure(activeTransition, browserState, result);
        goal.tracker.lastFailure = failure.message;
        goal.tracker.attemptCount++;

        // Increment retry attempts and escalate if limit reached
        const transitionId = activeTransition.id;
        transitionAttempts[transitionId] = (transitionAttempts[transitionId] || 0) + 1;
        if (transitionAttempts[transitionId] >= 3) {
          console.log(`[RECOVERY ESCALATION] Transition ${transitionId} failed ${transitionAttempts[transitionId]} times. Blacklisting capability: ${capability.name}`);
          goal.blacklistedCapabilities.push(capability.name);
        }

        // Check for human intervention post-failure
        const postFailIntervention = checkForHumanIntervention(browserState);
        if (postFailIntervention) {
          console.log(`[HUMAN_INTERVENTION] Post-failure state: ${postFailIntervention.state}, Reason: ${postFailIntervention.reason}`);
          const summary = generateExecutionSummary(context);
          return {
            success: false,
            reason: postFailIntervention.state,
            observation: latestObs,
            contextSummary: summary
          };
        }

        const recoveryActions = determineRecovery(failure, activeTransition, capability);
        if (recoveryActions && recoveryActions.length > 0) {
          recoveryCount++;
          console.log(`[RECOVERY] Executing recovery actions for failure: ${failure.type}`);
          const recPlan = createPlan(goal.id, recoveryActions);
          const recResult = await executePlan(recPlan);
          const recObs = recResult.observations || [];
          latestObs = recObs[recObs.length - 1] || latestObs;
          browserState = latestObs?.pageState || latestObs || {};
          totalActions += recPlan.actions.length;
          updateWorldModel(goal, latestObs);

          const postRecoveryVerified = capability.verify(activeTransition, latestObs);
          if (postRecoveryVerified) {
            console.log("[RECOVERY] Target state verified after recovery.");
            recordCapabilityExecution(goal.tracker, capability.name, "success", recoveryCount);
            executeSuccess = true;
          } else {
            console.log("[RECOVERY] Target state verification still failed after recovery.");
          }
        }
      }
    } else {
      console.log("[AGENT] No capability matched or no execution plan generated. Attempting recovery...");
      const failure = { type: "element_missing", message: "No capability matched transition", browserState };
      const recoveryActions = determineRecovery(failure, activeTransition);
      if (recoveryActions && recoveryActions.length > 0) {
        const recPlan = createPlan(goal.id, recoveryActions);
        const recResult = await executePlan(recPlan);
        const recObs = recResult.observations || [];
        latestObs = recObs[recObs.length - 1] || latestObs;
        browserState = latestObs?.pageState || latestObs || {};
        totalActions += recPlan.actions.length;
        updateWorldModel(goal, latestObs);
      } else {
        console.log("[AGENT] Recovery failed to generate actions.");
        const summary = generateExecutionSummary(context);
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