import { createGoalPlan, parsePlanResponse } from "./planner.js";
import { createReplan } from "./replanner.js";
import { verifyGoal }
from "./goalVerifier.js";
import { isGoalImpossible }
  from "./failureVerifier.js";
export async function runAgent({
    goal,
    executePlan
}) {

    const MAX_RETRIES = 3;

    let plan =
        await createGoalPlan(goal);
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
const informationalActions = [
  "read_ui",
  "get_browser_context",
  "list_tabs"
];

if (
  informationalActions.includes(
    observation?.action?.type
  )
) {

  return {
    success: true,
    observation
  };
}
  const verification =
    await verifyGoal({
  goal: goal.objective,
  observation,
  observations
});

  console.log(
    "GOAL VERIFICATION:",
    verification
  );

  if (
    verification.achieved
  ) {

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

        const impossible =
  await isGoalImpossible({
    goal: goal.objective,
    observations
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