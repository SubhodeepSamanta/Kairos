import { createGoalPlan, parsePlanResponse } from "./planner.js";
import { createReplan } from "./replanner.js";

export async function runAgent({
    goal,
    executePlan
}) {

    const MAX_RETRIES = 3;

    let plan =
        await createGoalPlan(goal);

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

if (
  allSucceeded &&
  attempt === 0
) {

  return {
    success: true,
    observation
  };
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

        console.log(
            "Replanning..."
        );

        const replanResponse =
            await createReplan({
                goal,
                previousPlan: plan,
                observation
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