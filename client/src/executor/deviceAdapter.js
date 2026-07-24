import { ACTIONS } from "../shared/schemas/action.js";
import { executeBrowserAction } from "./browserAdapter.js";
import { executeDesktopAction } from "./desktopAdapter.js";

const DESKTOP_ACTIONS = new Set([
  ACTIONS.OPEN_APP,
  ACTIONS.CLOSE_APP,
  ACTIONS.FOCUS_APP,
  ACTIONS.LIST_APPS,
  ACTIONS.READ_DESKTOP,
  ACTIONS.CLICK_ELEMENT,
  ACTIONS.TYPE_INTO,
  ACTIONS.SET_TOGGLE,
  ACTIONS.SELECT_MENU,
  ACTIONS.PRESS_KEYS,
  ACTIONS.CLICK_AT
]);

export async function executeDeviceAction(action) {
  if (DESKTOP_ACTIONS.has(action.type)) {
    return await executeDesktopAction(action);
  }
  return await executeBrowserAction(action);
}
