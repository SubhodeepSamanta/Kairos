import { createPlan } from "../../shared/schemas/plan.js";
import { llmCallCount, resetLlmCallCount } from "../../llm/provider.js";
import { updateWorldModel, addFinding } from "../../world/worldModel.js";
import { extractDataFromPage } from "../../reasoning/extractor.js";
import { understandPage } from "../../world/pageUnderstandingV2.js";
import { initTracker } from "../../reasoning/objectiveTracker.js";
import { verifyGoal } from "../../verification/objectiveVerifier.js";
import { createExecutionContext, generateExecutionSummary } from "../../world/executionContext.js";
import { loadAgentSession, saveAgentSession } from "../state/agentSession.js";
import { selectActionWithLLM } from "../../reasoning/llmActionSelector.js";
import { determineRecovery } from "../recovery/recovery.js";
import { WorkflowMemory } from "../../memory/workflowMemory.js";
import { decomposeGoal } from "./goalDecomposer.js";
import { estimateProgress, updateSubObjectives } from "./subObjectives.js";
import { printMetrics, extractBrowserState, detectActionLoop } from "./loopUtils.js";
import { requestHumanIntervention } from "./humanIntervention.js";

export async function runAgent({
    goal,
    executePlan
}) {
  resetLlmCallCount();
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
    try {
      return await executePlan(plan);
    } catch (err) {
      if (err.message === "No connected client") {
        console.error("[AGENT] Client disconnected during execution. Stopping agent.");
        return { observations: [], clientDisconnected: true };
      }
      throw err;
    }
  };

  try {
    const res = await _runAgentInternal({ goal, executePlan: wrapExecutePlan });
    printMetrics(goal, startTime, startLlmCalls);
    return res;
  } catch (err) {
    console.error(`[AGENT FATAL ERROR] Goal "${goal.objective}" crashed with:`, err.message);
    console.error(err.stack);
    printMetrics(goal, startTime, startLlmCalls);
    throw err;
  }
}

async function _runAgentInternal({
    goal,
    executePlan
}) {
  const MAX_GOAL_ACTIONS = 30;
  const initReadPlan = {
    goalId: goal.id,
    actions: [{ type: "read_ui", params: {} }]
  };
  console.log("[AGENT] Fetching initial page state...");
  const initResult = await executePlan(initReadPlan);
  const initObs = initResult?.observations?.[initResult.observations.length - 1];
  if (initObs) {
    updateWorldModel(goal, initObs);
    goal.metrics.totalActions = 0;
  }

  let latestObs = initObs || goal.world?.history?.[goal.world.history.length - 1]?.observation;
  let browserState = extractBrowserState(latestObs);

  const savedSession = loadAgentSession(goal.id);
  let context;
  let workflowMemory;
  if (savedSession) {
    console.log(`[AGENT] Resuming workflow from saved state: ${savedSession.stateType}`);
    context = savedSession.context;
    goal.tracker = savedSession.tracker;
    workflowMemory = Object.assign(new WorkflowMemory(), savedSession.workflowMemory);
    if (savedSession.findings && goal.world) {
      goal.world.findings = savedSession.findings;
    }
  } else {
    context = createExecutionContext(goal);
    goal.tracker = initTracker([{ desiredState: "goal_completed", objective: goal.objective }]);
    workflowMemory = new WorkflowMemory();

    const subObjectives = await decomposeGoal(goal.objective, browserState);
    workflowMemory.currentObjective = goal.objective;
    workflowMemory.currentSubObjective = subObjectives[0] || goal.objective;
    workflowMemory.subObjectives = subObjectives;
    workflowMemory.completedSubObjectives = [];
  }
  goal.context = context;
  goal.workflowMemory = workflowMemory;

  const intentCheck = workflowMemory.handleWorkflowIntents(goal.objective);
  if (intentCheck) {
    console.log(`[WORKFLOW INTENT] Intercepted memory directive: ${intentCheck.action}`);
    if (intentCheck.action === "close_tab") {
      const closePlan = {
        goalId: goal.id,
        actions: [{ type: "close_tab", params: {} }]
      };
      await executePlan(closePlan);
    } else if (intentCheck.action === "navigate" && intentCheck.url) {
      const navPlan = {
        goalId: goal.id,
        actions: [{ type: "navigate", params: { url: intentCheck.url } }]
      };
      await executePlan(navPlan);
    }
  }

  const initResultObs = await requestHumanIntervention(
    goal, browserState, null, null, context, workflowMemory, latestObs, executePlan
  );
  if (initResultObs?.escalation) {
    return { success: false, reason: initResultObs.escalation, observation: latestObs, contextSummary: generateExecutionSummary(context, goal.tracker) };
  }
  if (initResultObs && initResultObs !== latestObs) {
    latestObs = initResultObs;
    browserState = extractBrowserState(latestObs);
  }

  if (await verifyGoal(goal, browserState, goal.world)) {
    console.log(`[GOAL COMPLETE] Initial browser state already satisfies the goal.`);
    const summary = generateExecutionSummary(context, goal.tracker);
    return {
      success: true,
      confidence: 1.0,
      observation: latestObs,
      contextSummary: summary
    };
  }

  let retryCount = 0;
  let lastAction = null;
  let staleRefCount = 0;
  let consecutiveFailuresByElement = {};

  let previousBrowserState = null;

  while (goal.metrics.totalActions < MAX_GOAL_ACTIONS) {
    previousBrowserState = { ...browserState };
    let result = null;

    if (detectActionLoop(goal.world)) {
      console.log("[LOOP DETECTION] Agent appears stuck.");
      retryCount++;

      if (retryCount <= 1) {
        console.log("[LOOP DETECTION] Attempting scroll+read recovery.");
        const unstickPlan = createPlan(goal.id, [
          { type: "scroll", params: { direction: "down", amount: 500 } },
          { type: "read_ui", params: {} }
        ]);
        const unstickResult = await executePlan(unstickPlan);
        latestObs = unstickResult?.observations?.[unstickResult.observations.length - 1] || latestObs;
        browserState = extractBrowserState(latestObs);
        updateWorldModel(goal, latestObs);
      } else if (retryCount === 2) {
        console.log("[LOOP DETECTION] Attempting go-back recovery.");
        const backPlan = createPlan(goal.id, [
          { type: "back", params: {} },
          { type: "read_ui", params: {} }
        ]);
        const backResult = await executePlan(backPlan);
        latestObs = backResult?.observations?.[backResult.observations.length - 1] || latestObs;
        browserState = extractBrowserState(latestObs);
        updateWorldModel(goal, latestObs);
      } else if (retryCount === 3) {
        console.log("[LOOP DETECTION] Attempting refresh+scroll recovery.");
        const refreshPlan = createPlan(goal.id, [
          { type: "refresh", params: {} },
          { type: "scroll", params: { direction: "down", amount: 1000 } },
          { type: "read_ui", params: {} }
        ]);
        const refreshResult = await executePlan(refreshPlan);
        latestObs = refreshResult?.observations?.[refreshResult.observations.length - 1] || latestObs;
        browserState = extractBrowserState(latestObs);
        updateWorldModel(goal, latestObs);
      } else {
        console.log("[LOOP DETECTION] Scroll didn't help. Replanning from current context.");
        const pageUnderstanding = understandPage(browserState);
        const newObjectives = await decomposeGoal(goal.objective, browserState);
        if (newObjectives && newObjectives.length > 0) {
          workflowMemory.subObjectives = newObjectives;
          workflowMemory.currentSubObjective = newObjectives[0];
          workflowMemory.completedSubObjectives = [];
          console.log(`[LOOP DETECTION] Replanned to: ${JSON.stringify(newObjectives)}`);
        }
        const bestCandidate = await selectActionWithLLM({
          goal,
          pageUnderstanding,
          browserState,
          workflowMemory
        });
        if (bestCandidate && bestCandidate.actions && bestCandidate.actions.length > 0) {
          const plan = createPlan(goal.id, bestCandidate.actions);
          const result = await executePlan(plan);
          if (result?.clientDisconnected) {
            return {
              success: false,
              reason: "client_disconnected",
              observation: latestObs,
              contextSummary: generateExecutionSummary(context, goal.tracker)
            };
          }
          latestObs = result?.observations?.[result.observations.length - 1] || latestObs;
          browserState = extractBrowserState(latestObs);
          lastAction = bestCandidate.actions[0];
          updateWorldModel(goal, latestObs);
        }
      }

      if (retryCount > 5) {
        return {
          success: false,
          reason: "agent_stuck_in_loop",
          observation: latestObs,
          contextSummary: generateExecutionSummary(context, goal.tracker)
        };
      }
      continue;
    }

    const pageUnderstanding = understandPage(browserState);

    updateSubObjectives(workflowMemory, browserState, pageUnderstanding, goal.world?.actionHistory);
    const progress = estimateProgress(workflowMemory, browserState);
    console.log(`[PROGRESS] ${progress.percent}% - ${progress.stage}`);

    const bestCandidate = await selectActionWithLLM({
      goal,
      pageUnderstanding,
      browserState,
      workflowMemory
    });

    const loopResult = await requestHumanIntervention(
      goal, browserState, pageUnderstanding, bestCandidate, context, workflowMemory, latestObs, executePlan
    );
    if (loopResult?.escalation) {
      return { success: false, reason: loopResult.escalation, observation: latestObs, contextSummary: generateExecutionSummary(context, goal.tracker) };
    }
    if (loopResult && loopResult !== latestObs) {
      latestObs = loopResult;
      browserState = extractBrowserState(latestObs);
    }

    if (!bestCandidate || !bestCandidate.actions || bestCandidate.actions.length === 0) {
      console.log(`[AGENT] No action candidate selected. Running recovery.`);
      const recoveryActions = determineRecovery(lastAction, browserState, previousBrowserState, retryCount);

      if (recoveryActions && recoveryActions.escalate) {
        console.log(`[RECOVERY ESCALATION] Escalating to: ${recoveryActions.state}`);
        const summary = generateExecutionSummary(context, goal.tracker);
        saveAgentSession(goal, goal.tracker, context, recoveryActions.state, null, workflowMemory);
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
      if (recResult?.clientDisconnected) {
        return {
          success: false,
          reason: "client_disconnected",
          observation: latestObs,
          contextSummary: generateExecutionSummary(context, goal.tracker)
        };
      }
      latestObs = recResult?.observations?.[recResult.observations.length - 1] || latestObs;
      browserState = extractBrowserState(latestObs);
      updateWorldModel(goal, latestObs);
      retryCount++;
      continue;
    }

    console.log(`[AGENT] Executing action: "${bestCandidate.label}"`);

    const plan = createPlan(goal.id, bestCandidate.actions);
    result = await executePlan(plan);

    if (result?.clientDisconnected) {
      return {
        success: false,
        reason: "client_disconnected",
        observation: latestObs,
        contextSummary: generateExecutionSummary(context, goal.tracker)
      };
    }

    latestObs = result?.observations?.[result.observations.length - 1] || latestObs;
    browserState = extractBrowserState(latestObs);

    const postResult = await requestHumanIntervention(
      goal, browserState, pageUnderstanding, bestCandidate, context, workflowMemory, latestObs, executePlan
    );
    if (postResult?.escalation) {
      return { success: false, reason: postResult.escalation, observation: latestObs, contextSummary: generateExecutionSummary(context, goal.tracker) };
    }
    if (postResult && postResult !== latestObs) {
      latestObs = postResult;
      browserState = extractBrowserState(latestObs);
    }

    lastAction = bestCandidate.actions[0];
    updateWorldModel(goal, latestObs);

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

    const actionSucceeded = result?.success !== false && latestObs?.success !== false;
    const pageChanged = latestObs && previousBrowserState && (
      (latestObs.url && latestObs.url !== previousBrowserState.url) ||
      (latestObs.title && latestObs.title !== previousBrowserState.title)
    );
    if (actionSucceeded && !pageChanged && bestCandidate.type !== "read_ui") {
      staleRefCount++;
      console.log(`[STALE_REF] Action succeeded but page unchanged (count: ${staleRefCount}).`);
      if (staleRefCount >= 2) {
        console.log(`[STALE_REF] Enforcing re-snapshot.`);
        const reReadPlan = createPlan(goal.id, [{ type: "read_ui", params: {} }]);
        const reReadResult = await executePlan(reReadPlan);
        latestObs = reReadResult?.observations?.[reReadResult.observations.length - 1] || latestObs;
        browserState = extractBrowserState(latestObs);
        updateWorldModel(goal, latestObs);
        staleRefCount = 0;
        continue;
      }
    } else {
      staleRefCount = 0;
    }

    const actionElement = bestCandidate.elementId || bestCandidate.actions?.[0]?.params?.element;
    const actionType = bestCandidate.actions?.[0]?.type || "";
    const actionFailed = result?.success === false || latestObs?.success === false;
    if (actionFailed && actionElement !== undefined) {
      const key = `${actionType}:${actionElement}`;
      consecutiveFailuresByElement[key] = (consecutiveFailuresByElement[key] || 0) + 1;
      console.log(`[RECOVERY] Consecutive failures on ${key}: ${consecutiveFailuresByElement[key]}`);
      if (consecutiveFailuresByElement[key] >= 2) {
        console.log(`[RECOVERY] Marking ${key} as failed.`);
        if (!goal.world.failedActionHistory) goal.world.failedActionHistory = [];
        goal.world.failedActionHistory.push({
          action: { type: actionType, params: { element: actionElement } },
          reason: `${consecutiveFailuresByElement[key]} consecutive failures`
        });
      }
    } else if (!actionFailed) {
      consecutiveFailuresByElement = {};
    }

    const verifyState = {
      ...browserState,
      pagePurpose: pageUnderstanding?.pagePurpose || browserState.pagePurpose || "",
      resolvedState: pageUnderstanding?.resolvedState || null
    };

    if (await verifyGoal(goal, verifyState, goal.world)) {
      console.log(`[GOAL COMPLETE] Overall goal satisfied.`);
      const summary = generateExecutionSummary(context, goal.tracker);
      return {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      };
    }

    if (actionFailed) {
      console.log(`[AGENT] Action failed. Diagnosing...`);
      const recoveryActions = await determineRecovery(lastAction, browserState, previousBrowserState, retryCount);

      if (recoveryActions && recoveryActions.escalate) {
        console.log(`[RECOVERY ESCALATION] Escalating to: ${recoveryActions.state}`);
        const summary = generateExecutionSummary(context, goal.tracker);
        saveAgentSession(goal, goal.tracker, context, recoveryActions.state, null, workflowMemory);
        return {
          success: false,
          reason: recoveryActions.state,
          observation: latestObs,
          contextSummary: summary
        };
      }

      const recPlan = createPlan(goal.id, recoveryActions);
      const recResult = await executePlan(recPlan);
      if (recResult?.clientDisconnected) {
        return {
          success: false,
          reason: "client_disconnected",
          observation: latestObs,
          contextSummary: generateExecutionSummary(context, goal.tracker)
        };
      }
      latestObs = recResult?.observations?.[recResult.observations.length - 1] || latestObs;
      browserState = extractBrowserState(latestObs);
      updateWorldModel(goal, latestObs);
      retryCount++;
    } else {
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
