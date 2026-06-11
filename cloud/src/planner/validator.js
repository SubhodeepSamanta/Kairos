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
  "close_tab",
  "switch_tab",
  "press_key",
  "wait",
  "scroll",
  "extract_links",
  "extract_metadata",
  "screenshot",
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

  if (
    action.type === "click" &&
    action.params?.element !== undefined &&
    typeof action.params.element !== "number"
  ) {
    continue;
  }

  if (
    action.type === "type" &&
    action.params?.element !== undefined &&
    typeof action.params.element !== "number"
  ) {
    continue;
  }

  if (
    action.type === "switch_tab" &&
    typeof action.params?.index !== "number"
  ) {
    continue;
  }

  actions.push(action);
}

  return {
    actions
  };
}