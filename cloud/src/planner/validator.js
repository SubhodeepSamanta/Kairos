const ALLOWED_ACTIONS = [
  "open_app",
  "close_app",
  "focus_app"
];

export function validatePlan(
  plan
) {
  const actions = [];

  for (
    const action of
    plan.actions || []
  ) {
    if (
      !ALLOWED_ACTIONS.includes(
        action.type
      )
    ) {
      continue;
    }

    actions.push(action);
  }

  return {
    actions
  };
}