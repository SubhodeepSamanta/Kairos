import { createPlan } from "../../shared/schemas/plan.js";
import { llmCallCount } from "../../llm/provider.js";
import { updateWorldModel, addFinding } from "../../world/worldModel.js";
import { extractDataFromPage } from "../../reasoning/extractor.js";
import { setIntent, setGoal, setPlan, setObservation } from "../state/state.js";
import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { understandPage } from "../../world/pageUnderstanding.js";
import { initTracker } from "../../reasoning/objectiveTracker.js";
import { verifyGoal } from "../../verification/objectiveVerifier.js";
import { createExecutionContext, generateExecutionSummary } from "../../world/executionContext.js";
import { loadAgentSession, saveAgentSession } from "../state/agentSession.js";
import { reasonNextActions } from "../../reasoning/browserReasoner.js";
import { routeCapability } from "../../capabilities/router.js";
import { determineRecovery } from "../recovery/recovery.js";

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
  
  // Set initial states in context
  let context = createExecutionContext(goal);
  goal.context = context;
  goal.tracker = initTracker([{ desiredState: "goal_completed", objective: goal.objective }]);

  // Check if initial page state satisfies goal
  if (verifyGoal(goal.objective, browserState, goal.world)) {
    console.log(`[GOAL COMPLETE] Initial browser state already satisfies the goal. Stopping execution.`);
    const summary = generateExecutionSummary(context, goal.tracker);
    return {
      success: true,
      confidence: 1.0,
      observation: latestObs,
      contextSummary: summary
    };
  }

  const MAX_GOAL_ACTIONS = 30;
  goal.blacklistedCapabilities = [];
  let retryCount = 0;
  let lastAction = null;

  while (goal.metrics.totalActions < MAX_GOAL_ACTIONS) {
    const pageUnderstanding = understandPage(browserState);
    
    // Reason next actions
    const candidates = reasonNextActions({
      goal: goal.objective,
      pageUnderstanding,
      browserState,
      history: goal.world.failedActionHistory || []
    });

    const bestCandidate = candidates[0];

    // If no candidate, or score is too low, attempt recovery
    if (!bestCandidate || bestCandidate.score < 20) {
      console.log(`[AGENT] Low confidence action score (${bestCandidate?.score || 0}). Running diagnoser recovery.`);
      const recoveryActions = determineRecovery(lastAction, browserState, null, retryCount);

      if (recoveryActions && recoveryActions.escalate) {
        console.log(`[RECOVERY ESCALATION] Escalating to: ${recoveryActions.state}`);
        const summary = generateExecutionSummary(context, goal.tracker);
        saveAgentSession(goal, goal.tracker, context, recoveryActions.state);
        return {
          success: false,
          reason: recoveryActions.state,
          observation: latestObs,
          contextSummary: summary
        };
      }

      console.log(`[RECOVERY] Executing recovery actions.`);
      const recPlan = createPlan(goal.id, recoveryActions);
      const recResult = await executePlan(recPlan);
      latestObs = recResult?.observations?.[recResult.observations.length - 1] || latestObs;
      browserState = latestObs?.pageState || latestObs || {};
      updateWorldModel(goal, latestObs);
      retryCount++;
      continue;
    }

    // Execute best candidate action
    console.log(`[AGENT] Executing action: "${bestCandidate.label}" (score: ${bestCandidate.score})`);
    
    // Route capability to register executor usage
    for (const action of bestCandidate.actions) {
      const cap = routeCapability(action.type, goal.blacklistedCapabilities);
      if (cap) {
        cap.executions++;
      }
    }

    const plan = createPlan(goal.id, bestCandidate.actions);
    const result = await executePlan(plan);
    latestObs = result?.observations?.[result.observations.length - 1] || latestObs;
    browserState = latestObs?.pageState || latestObs || {};
    lastAction = bestCandidate.actions[0];

    // Update world model
    updateWorldModel(goal, latestObs);

    // Extraction handling
    if (bestCandidate.type === "extract" && latestObs?.success) {
      const pageText = browserState.text || "";
      const cleanQuery = bestCandidate.actions[0]?.params?.query || goal.objective;
      console.log(`[EXTRACT] Extracting data for query: "${cleanQuery}"...`);
      const extractedData = await extractDataFromPage(pageText, cleanQuery);
      addFinding(goal, {
        query: cleanQuery,
        data: extractedData,
        source: { url: browserState.url || "", title: browserState.title || "" }
      });
      console.log(`[EXTRACT] Finding added to world model:`, JSON.stringify(extractedData));
    }

    // Check if goal achieved
    if (verifyGoal(goal.objective, browserState, goal.world)) {
      console.log(`[GOAL COMPLETE] Overall goal satisfied.`);
      const summary = generateExecutionSummary(context, goal.tracker);
      return {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      };
    }

    // Check if execution failed
    if (result.success === false || latestObs?.success === false) {
      console.log(`[AGENT] Action failed. Diagnosing...`);
      const recoveryActions = determineRecovery(lastAction, browserState, null, retryCount);

      if (recoveryActions && recoveryActions.escalate) {
        console.log(`[RECOVERY ESCALATION] Escalating to: ${recoveryActions.state}`);
        const summary = generateExecutionSummary(context, goal.tracker);
        saveAgentSession(goal, goal.tracker, context, recoveryActions.state);
        return {
          success: false,
          reason: recoveryActions.state,
          observation: latestObs,
          contextSummary: summary
        };
      }

      const recPlan = createPlan(goal.id, recoveryActions);
      const recResult = await executePlan(recPlan);
      latestObs = recResult?.observations?.[recResult.observations.length - 1] || latestObs;
      browserState = latestObs?.pageState || latestObs || {};
      updateWorldModel(goal, latestObs);
      retryCount++;
    } else {
      // Reset retry count on successful action execution
      retryCount = 0;
    }
  }

  console.log(`[BUDGET] Goal action limit reached.`);
  const summary = generateExecutionSummary(context, goal.tracker);
  return {
    success: false,
    reason: "goal_action_budget_exceeded",
    observation: latestObs,
    contextSummary: summary
  };
}
