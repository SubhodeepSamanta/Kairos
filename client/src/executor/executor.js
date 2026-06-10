import { ACTIONS } from "../shared/schemas/action.js";
import { openApp,closeApp,focusApp } from "../automation/desktop/windows/apps.js";
import { navigate } from "../automation/browser/actions/navigate.js";
import { readPage } from "../automation/browser/actions/read.js";
import { getContext } from "../automation/browser/actions/getContext.js";
import { typeText } from "../automation/browser/actions/type.js";
import { clickText } from "../automation/browser/actions/click.js";
import { createSnapshot } from "../automation/browser/actions/snapshot.js";
import {
  closeCurrentBrowser
} from "../automation/browser/closeBrowser.js";

import {
  restartCurrentBrowser
} from "../automation/browser/restartBrowser.js";

import { goBack }
from "../automation/browser/actions/back.js";

import { goForward }
from "../automation/browser/actions/forward.js";

import { refreshPage }
from "../automation/browser/actions/refresh.js";

import {
  getTabs
} from "../automation/browser/actions/listTabs.js";

import {
  newTab
} from "../automation/browser/actions/newTab.js";

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

  const before =
    await createSnapshot();

  const result =
    await executeAction(action);

  const after =
    await createSnapshot();

  result.before = before;
  result.after = after;

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
  
  case ACTIONS.TYPE:
  return await typeText(
    action.params.text
  );

  case ACTIONS.CLICK:
  return await clickText(
    action.params.text
  );

case ACTIONS.READ_UI:
  return await readPage();

case ACTIONS.GET_BROWSER_CONTEXT:
  return await getContext();
case ACTIONS.CLOSE_BROWSER:
  return await closeCurrentBrowser();
  case ACTIONS.BACK:
  return await goBack();

case ACTIONS.FORWARD:
  return await goForward();

case ACTIONS.REFRESH:
  return await refreshPage();
  case ACTIONS.LIST_TABS:
  return await getTabs();

case ACTIONS.RESTART_BROWSER:
  return await restartCurrentBrowser();
  case ACTIONS.NEW_TAB:
  return await newTab();
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