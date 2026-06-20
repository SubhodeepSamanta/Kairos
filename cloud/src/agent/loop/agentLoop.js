import { createPlan } from "../../shared/schemas/plan.js";
import { llmCallCount } from "../../llm/provider.js";
import { updateWorldModel, addFinding } from "../../world/worldModel.js";
import { extractDataFromPage } from "../../reasoning/extractor.js";
import { setIntent, setGoal, setPlan, setObservation } from "../state/state.js";
import { parseIntent } from "../../reasoning/intentParser.js";
import { buildObjectives } from "../../reasoning/objectiveBuilder.js";
import { initTracker } from "../../reasoning/objectiveTracker.js";
import { verifyObjective } from "../../verification/objectiveVerifier.js";
import { createExecutionContext, generateExecutionSummary } from "../../world/executionContext.js";
import { loadAgentSession } from "../state/agentSession.js";

import { processObjectives } from "./objectiveLoop.js";
import { processTransitions } from "./transitionLoop.js";
import { selectCapabilityAndPlan } from "./executionLoop.js";
import { handleCapabilityFailure, executeAndVerify, handleNoCapabilityMatched } from "./verificationLoop.js";

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

  const preIntentCalls = llmCallCount;
  const intent = await parseIntent(
    goal.objective,
    {
      currentPlatform:
        browserState.site,

      currentPageType:
        browserState.pageType,

      currentUrl:
        browserState.url,

      currentTitle:
        browserState.title
    }
  );
  goal.metrics.intent_calls = llmCallCount - preIntentCalls;
  goal.intent = intent;
  setIntent(intent);

  console.log("INTENT:", JSON.stringify(intent, null, 2));

  const objectives = buildObjectives(intent);
  goal.objectives = objectives;
  goal.tracker = initTracker(objectives);

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

  let totalActions = { val: 0 };
  const MAX_GOAL_ACTIONS = 30;
  goal.blacklistedCapabilities = [];
  
  const failedTransitions = {}; 
  const transitionRetries = {};
  const objectiveRetries = {};
  let totalGoalRetries = { val: 0 };
  let lastResolvedState = { val: null };

  const transitionAuditHistory = [];

  while (true) {
    const objResult = await processObjectives({
      goal,
      browserState,
      latestObs,
      intent,
      context,
      lastResolvedState
    });

    if (objResult.shouldExit) {
      return objResult.exitValue;
    }
    if (objResult.shouldContinue) {
      lastResolvedState.val = objResult.resolvedCurState;
      continue;
    }

    const { resolvedCurState, currentObj } = objResult;

    const transResult = processTransitions({
      goal,
      resolvedCurState,
      currentObj,
      failedTransitions,
      latestObs,
      context,
      totalActions: totalActions.val,
      MAX_GOAL_ACTIONS
    });

    if (transResult.shouldExit) {
      return transResult.exitValue;
    }

    const { activeTransition } = transResult;

    const { capability, plan } = selectCapabilityAndPlan({
      goal,
      activeTransition,
      browserState
    });

    if (capability && !plan) {
      const failResult = await handleCapabilityFailure({
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
      });

      if (failResult.shouldExit) {
        return failResult.exitValue;
      }
      latestObs = failResult.latestObs;
      browserState = failResult.browserState;
    }

    if (plan) {
      const execResult = await executeAndVerify({
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
      });

      if (execResult.shouldExit) {
        return execResult.exitValue;
      }
      if (execResult.shouldContinue) {
        latestObs = execResult.latestObs;
        browserState = execResult.browserState;
        continue;
      }
      latestObs = execResult.latestObs;
      browserState = execResult.browserState;
    }

    if (!capability) {
      const noCapResult = await handleNoCapabilityMatched({
        goal,
        activeTransition,
        browserState,
        latestObs,
        executePlan,
        totalActions
      });

      if (noCapResult.shouldExit) {
        return noCapResult.exitValue;
      }
      if (noCapResult.shouldContinue) {
        latestObs = noCapResult.latestObs;
        browserState = noCapResult.browserState;
        continue;
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
