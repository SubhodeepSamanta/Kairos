const ALLOWED_ACTIONS = [
  "open_app",
  "close_app",
  "focus_app",

  "navigate",
  "read_ui",
  "type",
  "click",

  "get_browser_context",
"back",
"forward",
"refresh",
"list_tabs",
  "close_browser",
  "new_tab",
  "restart_browser"
];

export function validatePlan(plan) {

  const actions = [];
console.log(
  "VALIDATED ACTIONS:",
  JSON.stringify(
    actions,
    null,
    2
  )
);
  for (const action of plan.actions || []) {

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