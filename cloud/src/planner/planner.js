import { createAction, ACTIONS } from "../shared/schemas/action.js";
import { createPlan } from "../shared/schemas/plan.js";

export async function createGoalPlan(goal) {
  const objective = goal.objective.toLowerCase();

  const actions = [];

  if (objective.includes("notepad")) {
    actions.push(
      createAction(
        ACTIONS.OPEN_APP,
        {
          app: "notepad"
        }
      )
    );
  }

  else if (objective.includes("calculator")) {
    actions.push(
      createAction(
        ACTIONS.OPEN_APP,
        {
          app: "calculator"
        }
      )
    );
  }

  else if (objective.includes("chrome")) {
    actions.push(
      createAction(
        ACTIONS.OPEN_APP,
        {
          app: "chrome"
        }
      )
    );
  }

  return createPlan(
    goal.id,
    actions
  );
}