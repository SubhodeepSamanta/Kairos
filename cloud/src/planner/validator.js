import {
  getBrowserState
} from "../agent/state.js";

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

export function validatePlan(
  plan
) {

  const browser =
    getBrowserState();

  const validElementIds =
    new Set([
      ...(browser?.inputs || [])
        .map(
          input => input.id
        ),

      ...(browser?.buttons || [])
        .map(
          button => button.id
        ),

      ...(browser?.links || [])
        .map(
          link => link.id
        )
    ]);

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

    if (
      action.type === "click"
    ) {

      if (
        action.params?.element !==
        undefined
      ) {

        if (
          typeof action.params.element !==
          "number"
        ) {
          continue;
        }

        if (
          !validElementIds.has(
            action.params.element
          )
        ) {

          console.log(
            "INVALID CLICK ELEMENT:",
            action.params.element
          );

          continue;
        }
      }
    }

    if (
      action.type === "type"
    ) {

      if (
        action.params?.element !==
        undefined
      ) {

        if (
          typeof action.params.element !==
          "number"
        ) {
          continue;
        }

        if (
          !validElementIds.has(
            action.params.element
          )
        ) {

          console.log(
            "INVALID TYPE ELEMENT:",
            action.params.element
          );

          continue;
        }
      }
    }

    if (
      action.type ===
      "switch_tab"
    ) {

      if (
        typeof action.params?.index !==
        "number"
      ) {
        continue;
      }
    }

    actions.push(action);
  }

  console.log(
    "VALIDATED ACTIONS:",
    JSON.stringify(
      actions,
      null,
      2
    )
  );

  return {
    actions
  };
}