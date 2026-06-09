import { ACTIONS } from "../shared/schemas/action.js";
import { openApp,closeApp,focusApp } from "../automation/desktop/windows/apps.js";
import { navigate } from "../automation/browser/actions/navigate.js";
import { readPage } from "../automation/browser/actions/read.js";
import { getContext } from "../automation/browser/actions/getContext.js";

export async function executePlan(plan) {
  console.log("\n===== EXECUTING PLAN =====");
  console.log(JSON.stringify(plan, null, 2));

  const results = [];

  for (const action of plan.actions) {
    console.log(
      "\nACTION:",
      action.type,
      action.params
    );

    const result =
      await executeAction(action);

    console.log(
      "RESULT:",
      result
    );

    results.push(result);
  }

  return results;
}

async function executeAction(action) {
  try {

    switch (action.type) {

      case ACTIONS.OPEN_APP:
        return await openApp(
          action.params.app
        );

      case ACTIONS.CLOSE_APP:
        return await closeApp(
          action.params.app
        );

      case ACTIONS.FOCUS_APP:
        return await focusApp(
          action.params.app
        );

        case ACTIONS.NAVIGATE:
  return await navigate(
    action.params.url
  );

case ACTIONS.READ_UI:
  return await readPage();

case ACTIONS.GET_BROWSER_CONTEXT:
  return await getContext();

      default:
        return {
          success: false,
          reason: "unsupported_action",
          action
        };
    }

  } catch (error) {

    return {
      success: false,
      reason: error.message,
      action
    };
  }
}