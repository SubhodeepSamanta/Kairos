import { ACTIONS }
from "../shared/schemas/action.js";

import {
  openApp,
  closeApp,
  focusApp
}
from "../automation/desktop/windows/apps.js";

export async function executePlan(
  plan
) {
  const results = [];

  for (
    const action of
    plan.actions
  ) {
    const result =
      await executeAction(
        action
      );

    results.push(
      result
    );
  }

  return results;
}

async function executeAction(
  action
) {
  switch (
    action.type
  ) {

    case ACTIONS.OPEN_APP:
      return openApp(
        action.params.app
      );

    case ACTIONS.CLOSE_APP:
      return closeApp(
        action.params.app
      );

    case ACTIONS.FOCUS_APP:
      return focusApp(
        action.params.app
      );

    default:
      throw new Error(
        `Unsupported action: ${action.type}`
      );
  }
}