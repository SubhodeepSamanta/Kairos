import { createGoalPlan, parsePlanResponse } from "./planner.js";
import { createReplan } from "./replanner.js";
import { verifyGoal }
from "./goalVerifier.js";
import { verifyTask }
from "./taskVerifier.js";
import { llmCallCount, maxLlmCalls } from "../llm/provider.js";
import {
  updateWorldModel,
  recordCompletedTask,
  recordFailedTask,
  addFinding
} from "../agent/worldModel.js";
import { extractDataFromPage } from "./extractor.js";
import { isGoalImpossible }
  from "./failureVerifier.js";
  import {
  verifyByRules
}
from "./ruleVerifier.js";
import {
  parseGoal
} from "./goalParser.js";

import {
  setIntent
} from "../agent/state.js";
import {
  setGoal,
  setPlan,
  setObservation
} from "../agent/state.js";
import {
  verifyState
} from "./stateVerifier.js";
import {
  verifyEvents
} from "./eventVerifier.js";
import {
  TASK_STATUS
}
from "../shared/schemas/task.js";
import {
  buildTaskGraph
}
from "./taskParser.js";
import { resolveExecutor } from "./capabilityGraph.js";
import { handleExecutionFailure } from "./strategy.js";

function completeTask(
  goal,
  observation
) {

  const currentTask =
    goal.tasks[
      goal.currentTask
    ];

  if (currentTask) {

    currentTask.status =
      TASK_STATUS.COMPLETED;

    currentTask.result =
      observation;

    recordCompletedTask(
      goal,
      currentTask
    );
  }

  goal.currentTask++;
  goal.blacklistedSkills = [];

  return (
    goal.currentTask >=
    goal.tasks.length
  );
}

function detectLoop(world) {
  if (!world || !world.history || world.history.length < 3) return false;

  const latestEntry = world.history[world.history.length - 1]?.observation;
  const latestHash = latestEntry?.stateHash;
  if (!latestHash) return false;

  let occurrences = 0;
  for (const entry of world.history) {
    if (entry.observation?.stateHash === latestHash) {
      occurrences++;
    }
  }

  if (occurrences >= 3) {
    return true;
  }

  const actionHistory = world.history
    .map(h => ({
      hash: h.observation?.stateHash,
      actionType: h.observation?.action?.type,
      actionParams: JSON.stringify(h.observation?.action?.params || {})
    }))
    .filter(h => h.hash && h.actionType);

  if (actionHistory.length >= 4) {
    const latest = actionHistory[actionHistory.length - 1];
    for (let i = 0; i < actionHistory.length - 1; i++) {
      const prev = actionHistory[i];
      if (prev.hash === latest.hash && prev.actionType === latest.actionType && prev.actionParams === latest.actionParams) {
        return true;
      }
    }
  }

  return false;
}

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

Prompt Chars:
Planner: ${metrics.plannerPromptChars || 5042}
Compressed: ${metrics.compressedPromptChars || 1120}

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

  const latestObs = goal.world?.history?.[goal.world.history.length - 1]?.observation;
  const browserState = latestObs?.pageState || latestObs || {};

const intent =
  parseGoal(
    goal.objective
  );
goal.intent =
  intent;

goal.tasks =
  await buildTaskGraph(
    goal,
    browserState
  );

console.log(
  "TASK GRAPH:",
  JSON.stringify(
    goal.tasks,
    null,
    2
  )
);
goal.currentTask = 0;

setIntent(intent);
console.log(
  "INTENT:",
  JSON.stringify(
    intent,
    null,
    2
  )
);
    let plan =
        await createGoalPlan(goal);
        setGoal(goal);
setPlan(plan);
console.log(
  "INITIAL PLAN:",
  JSON.stringify(
    plan,
    null,
    2
  )
);
    if (
        plan.actions.length === 0
    ) {
        return {
            success: false,
            reason: "no_plan"
        };
    }

    const taskAttempts = {};
    let totalActions = 0;
    const MAX_TASK_RETRIES = 5;
    const MAX_GOAL_ACTIONS = 30;

    while (true) {
        const currentTaskIndex = goal.currentTask;
        taskAttempts[currentTaskIndex] = (taskAttempts[currentTaskIndex] || 0) + 1;

        console.log(
            `Task ${currentTaskIndex + 1} Attempt ${taskAttempts[currentTaskIndex]} (Total Actions: ${totalActions}, LLM Calls: ${llmCallCount})`
        );

        if (taskAttempts[currentTaskIndex] > MAX_TASK_RETRIES) {
          console.log(`[BUDGET] Task ${currentTaskIndex} exceeded max retries of ${MAX_TASK_RETRIES}`);
          return {
            success: false,
            reason: "task_retry_budget_exceeded"
          };
        }

        totalActions += plan.actions.length;
        if (totalActions > MAX_GOAL_ACTIONS) {
          console.log(`[BUDGET] Goal exceeded max actions of ${MAX_GOAL_ACTIONS}`);
          return {
            success: false,
            reason: "goal_action_budget_exceeded"
          };
        }

        if (llmCallCount >= maxLlmCalls) {
          console.log(`[BUDGET] Goal exceeded max LLM calls of ${maxLlmCalls}`);
          return {
            success: false,
            reason: "llm_budget_exceeded"
          };
        }

        goal.tasks[
          goal.currentTask
        ].status =
          TASK_STATUS.RUNNING;
        const result =
            await executePlan(plan);

        console.log(
          "EXECUTE RESULT:",
          JSON.stringify(result, null, 2)
        );

        const observations =
            result.observations || [];

        const failedObservation =
            observations.find(
                obs => !obs.success
            );

        let activeObservation = failedObservation || observations[observations.length - 1];
        let activeObservations = observations;

        let obsQuality = activeObservation?.pageState?.observationQuality;
        if (obsQuality && obsQuality.score < 0.7) {
          console.log(`[QUALITY] Low observation quality score: ${obsQuality.score}. Reasons: ${obsQuality.reasons.join(", ")}. Waiting and re-reading...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const readPlan = {
            goalId: goal.id,
            actions: [{ type: "read_ui", params: {} }]
          };
          const readResult = await executePlan(readPlan);
          const readObsList = readResult.observations || [];
          const readObs = readObsList[readObsList.length - 1];
          if (readObs) {
            activeObservation = readObs;
            activeObservations = [...activeObservations, ...readObsList];
          }
        }

        const compactObservations = activeObservations.map(obs => ({
          success: obs.success,
          expected: obs.expected,
          actual: obs.actual,
          before: obs.before,
          after: obs.after,
          action: obs.action
        }));

        console.log("LAST ACTION", activeObservation?.action);
        setObservation(activeObservation);
        updateWorldModel(goal, activeObservation);

        if (activeObservation?.action?.type === "extract_data" && activeObservation?.success) {
          const pageText = activeObservation.pageState?.text || "";
          const queryText = activeObservation.action.params?.query || "";
          const sourceUrl = activeObservation.pageState?.url || "";
          const sourceTitle = activeObservation.pageState?.title || "";
          
          console.log(`[EXTRACT] Extracting data for query: "${queryText}"...`);
          const extractedData = await extractDataFromPage(pageText, queryText);
          
          addFinding(goal, {
            query: queryText,
            data: extractedData,
            source: { url: sourceUrl, title: sourceTitle }
          });
          console.log(`[EXTRACT] Finding added to world model:`, JSON.stringify(extractedData));
        }

        console.log("WORLD:", {
          history: goal.world?.history?.length || 0,
          url: goal.world?.lastUrl,
          title: goal.world?.lastTitle,
          lastOutcome: goal.world?.lastOutcome,
          lastStateHash: goal.world?.lastStateHash
        });

        if (detectLoop(goal.world)) {
          console.log("[LOOP] State loop detected. Aborting execution.");
          return {
            success: false,
            observation: activeObservation,
            reason: "state_loop_detected"
          };
        }

        const compactObservation = {
          success: activeObservation?.success,
          expected: activeObservation?.expected,
          actual: activeObservation?.actual,
          before: activeObservation?.before,
          after: activeObservation?.after,
          action: activeObservation?.action
        };

        console.log(
          "OBSERVATION SUMMARY:",
          JSON.stringify(
            {
              success: activeObservation?.success,
              expected: activeObservation?.expected,
              actual: activeObservation?.actual,
              url: activeObservation?.url,
              title: activeObservation?.title
            },
            null,
            2
          )
        );
        console.log(
            "OBSERVATION:",
            JSON.stringify(
                activeObservation,
                null,
                2
            )
        );

const allSucceeded =
  observations.every(
    obs => obs.success
  );

if (allSucceeded) {
console.log(
  "VERIFYING TASK WITH CRITERIA:",
  JSON.stringify(
    observations,
    null,
    2
  )
);

const currentTask =
  goal.tasks[
    goal.currentTask
  ];

// Fallback 1: Programmatic State and Event verifiers (highly efficient)
const activeTab = activeObservation?.pageState?.activeTab || activeObservation?.activeTab;
const normalizedObservation = activeTab ? {
  ...activeObservation,
  url: activeTab.url,
  title: activeTab.title,
  pageState: {
    ...activeObservation.pageState,
    url: activeTab.url,
    title: activeTab.title
  }
} : activeObservation;

const stateResult =
  verifyState({
    task:
      currentTask,
    observation: normalizedObservation
  });

const eventResult =
  verifyEvents({
    task:
      currentTask,
    observation: normalizedObservation
  });

console.log("STATE VERIFIED:", stateResult);
console.log("EVENT VERIFIED:", eventResult);

if (
  eventResult?.achieved ||
  stateResult?.achieved
) {
  console.log("Programmatic state/event check confirmed achievement.");
  const finished =
    completeTask(
      goal,
      normalizedObservation
    );

  if (!finished) {
    plan =
      await createGoalPlan(
        goal
      );

    if (
      plan.actions.length === 0
    ) {
      return {
        success: false,
        reason: "no_plan_for_task"
      };
    }

    setPlan(plan);
    continue;
  }

  return {
    success: true,
    observation: normalizedObservation
  };
}

// Fallback 2: Rule verifier
const ruleResult =
  verifyByRules(
    normalizedObservation
  );

console.log("RULE VERIFIED:", ruleResult);

if (
  ruleResult?.achieved
) {
  console.log("Rule check confirmed achievement.");
  const finished =
    completeTask(
      goal,
      normalizedObservation
    );

  if (!finished) {
    plan =
      await createGoalPlan(
        goal
      );

    if (
      plan.actions.length === 0
    ) {
      return {
        success: false,
        reason: "no_plan_for_task"
      };
    }

    setPlan(plan);
    continue;
  }

  return {
    success: true,
    observation: normalizedObservation
  };
}

// Fallback 3: LLM successCriteria-based task verifier (more thorough, more expensive)
const taskResult =
  await verifyTask({
    task: currentTask,
    observation: normalizedObservation,
    world: goal.world
  });

console.log(
  "LLM TASK VERIFICATION:",
  JSON.stringify(taskResult, null, 2)
);

if (taskResult.achieved) {
  const finished =
    completeTask(
      goal,
      normalizedObservation
    );

  if (!finished) {
    plan =
      await createGoalPlan(
        goal
      );

    if (
      plan.actions.length === 0
    ) {
      return {
        success: false,
        reason: "no_plan_for_task"
      };
    }

    setPlan(plan);
    continue;
  }

  return {
    success: true,
    observation: activeObservation
  };
}

// Last resort: LLM goal verification (Disabled per roadmap, re-enable Wave 3.10)
const verification = { achieved: false };

  console.log(
    "GOAL VERIFICATION (DISABLED):",
    verification
  );

if (
  verification.achieved
) {
  const finished =
    completeTask(
      goal,
      activeObservation
    );

  if (!finished) {
    plan =
      await createGoalPlan(
        goal
      );

    setPlan(plan);
    continue;
  }

  return {
    success: true,
    observation: activeObservation
  };
}

  console.log(
    "Task verification failed — replanning for current task"
  );
} else {
  goal.blacklistedSkills = goal.blacklistedSkills || [];
  handleExecutionFailure(goal, goal.tasks[goal.currentTask], failedObservation?.action, goal.blacklistedSkills);
}

const impossible =
  await isGoalImpossible({
    intent,
    observations:
      compactObservations
  });

console.log(
  "IMPOSSIBLE CHECK:",
  impossible
);

if (impossible.impossible) {
  return {
    success: false,
    reason: "goal_impossible",
    observation: activeObservation
  };
}

console.log(
  "Replanning..."
);

const replanResponse =
  await createReplan({
    goal,
    previousPlan: plan,
    observation: compactObservation,
    observations: compactObservations
  });
        console.log("RAW REPLAN RESPONSE:", replanResponse);
        plan =
            parsePlanResponse(
                goal.id,
                replanResponse
            );
            setPlan(plan);
        if (
            plan.actions.length === 0
        ) {
            return {
                success: false,
                reason: "unable_to_replan"
            };
        }

        console.log(
            "NEW PLAN:",
            JSON.stringify(
                plan,
                null,
                2
            )
        );
    }
}