import { createGoal } from "./src/shared/schemas/goal.js";
import { createGoalPlan } from "./src/reasoning/planner.js";

const goal = createGoal(
  "open youtube.com"
);

const plan =
  await createGoalPlan(goal);

console.log(
  JSON.stringify(
    plan,
    null,
    2
  )
);