import { createGoalPlan, parsePlanResponse } from "./planner.js";
import { createReplan } from "./replanner.js";
import { verifyGoal }
from "./goalVerifier.js";
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
  }

  goal.currentTask++;

  return (
    goal.currentTask >=
    goal.tasks.length
  );
}

export async function runAgent({
    goal,
    executePlan
}) {

    const MAX_RETRIES = 3;
const intent =
  parseGoal(
    goal.objective
  );
goal.intent =
  intent;

goal.tasks =
  await buildTaskGraph(
    goal
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

    for (
        let attempt = 0;
        attempt < MAX_RETRIES;
        attempt++
    ) {

        console.log(
            `Attempt ${attempt + 1}`
        );
goal.tasks[
  goal.currentTask
].status =
  TASK_STATUS.RUNNING;
        const result =
            await executePlan(plan);

        const observations =
            result.observations || [];

        const failedObservation =
            observations.find(
                obs => !obs.success
            );

        const observation =
            failedObservation ||
            observations[
            observations.length - 1
            ];
            setObservation(
  observation
);
            console.log(
  "OBSERVATION SUMMARY:",
  JSON.stringify(
    {
      success:
        observation?.success,
      expected:
        observation?.expected,
      actual:
        observation?.actual,
      url:
        observation?.url,
      title:
        observation?.title
    },
    null,
    2
  )
);
        console.log(
            "OBSERVATION:",
            JSON.stringify(
                observation,
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
  "VERIFYING GOAL WITH:",
  JSON.stringify(
    observations,
    null,
    2
  )
);

const stateResult =
  verifyState({
    intent,
    observation
  });

const eventResult =
  verifyEvents({
    intent,
    observation
  });
if (
  eventResult?.achieved
) {

  const finished =
    completeTask(
      goal,
      observation
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

  attempt = -1;

  continue;
}
if (
  plan.actions.length === 0
) {

  return {
    success: false,
    reason: "no_plan_for_task"
  };
}
  return {
    success: true,
    observation
  };
}
if (
  stateResult?.achieved
) {

  const finished =
    completeTask(
      goal,
      observation
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

  attempt = -1;

  continue;
}

  return {
    success: true,
    observation
  };
}

const ruleResult =
  verifyByRules(
    observation
  );

if (
  ruleResult?.achieved
) {

  const finished =
    completeTask(
      goal,
      observation
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

  attempt = -1;

  continue;
}

  return {
    success: true,
    observation
  };
}

const compactObservation = {
  success:
    observation?.success,

  expected:
    observation?.expected,

  actual:
    observation?.actual,

  before:
    observation?.before,

  after:
    observation?.after,

  action:
    observation?.action
};

const verification =
await verifyGoal({
  goal,
  task:goal.tasks[goal.currentTask],
  intent,
  observation:compactObservation,
  observations:compactObservations
});

  console.log(
    "GOAL VERIFICATION:",
    verification
  );

if (
  verification.achieved
) {

  const finished =
    completeTask(
      goal,
      observation
    );

if (!finished) {

  plan =
    await createGoalPlan(
      goal
    );

  setPlan(plan);

  attempt = -1;

  continue;
}

  return {
    success: true,
    observation
  };
}

  console.log(
    "Goal verification failed"
  );
}

        if (
  attempt ===
  MAX_RETRIES - 1
) {

  return {
    success: false,
    observation,
    reason:
      "goal_not_achieved"
  };
}

const compactObservations =
  observations.map(obs => ({
    success:
      obs.success,

    expected:
      obs.expected,

    actual:
      obs.actual,

    before:
      obs.before,

    after:
      obs.after,

    action:
      obs.action
  }));

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
    observation
  };
}

console.log(
  "Replanning..."
);

const replanResponse =
  await createReplan({
    goal,
    previousPlan: plan,
    observation,
    observations
  });
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