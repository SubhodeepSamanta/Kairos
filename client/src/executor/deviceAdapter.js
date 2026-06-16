import { ACTIONS } from "../shared/schemas/action.js";
import { executeBrowserAction } from "./browserAdapter.js";
import { executeDesktopAction } from "./desktopAdapter.js";

export async function executeDeviceAction(action) {
  const desktopActions = [
    ACTIONS.OPEN_APP,
    ACTIONS.CLOSE_APP,
    ACTIONS.FOCUS_APP
  ];

  if (desktopActions.includes(action.type)) {
    return await executeDesktopAction(action);
  } else {
    return await executeBrowserAction(action);
  }
}
