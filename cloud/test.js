import { createGoal } from "./src/shared/schemas/goal.js";
import { createGoalPlan } from "./src/planner/planner.js";

const goal =
  createGoal(
    "open my browser"
  );

const plan =
  await createGoalPlan(
    goal
  );

console.log(
  JSON.stringify(
    plan,
    null,
    2
  )
);