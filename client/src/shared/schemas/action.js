export const ACTIONS = {
  OPEN_APP: "open_app",
  CLOSE_APP: "close_app",
  FOCUS_APP: "focus_app",
  LIST_APPS: "list_apps",
  READ_DESKTOP: "read_desktop",
  CLICK_ELEMENT: "click_element",
  TYPE_INTO: "type_into",
  SET_TOGGLE: "set_toggle",
  SELECT_MENU: "select_menu",
  PRESS_KEYS: "press_keys",
  CLICK_AT: "click_at",
  CLICK: "click",
  TYPE: "type",
  NAVIGATE: "navigate",
  READ_UI: "read_ui",
  CLOSE_BROWSER:
  "close_browser",
  BACK: "back",
FORWARD: "forward",
REFRESH: "refresh",
LIST_TABS: "list_tabs",
NEW_TAB: "new_tab",
SWITCH_TAB:
  "switch_tab",
  PRESS_KEY:
  "press_key",
  SCROLL:
  "scroll",
  WAIT:
  "wait",
  EXTRACT_METADATA:
  "extract_metadata",
  EXTRACT_LINKS:
  "extract_links",
  SCREENSHOT:
  "screenshot",
  CLOSE_TAB:
  "close_tab",
  RESTART_BROWSER:
  "restart_browser",
  GET_BROWSER_CONTEXT: "get_browser_context",
  EXTRACT_DATA: "extract_data",
  HUMAN_INPUT: "human_input",
  USE_BROWSER: "use_browser",
  LIST_BROWSERS: "list_browsers",
  NEW_WINDOW: "new_window",
  SELECT_OPTION: "select_option",
  OPEN_FOR_USER: "open_for_user",
  CLOSE_USER_BROWSER: "close_user_browser"
};

export function createAction(
  type,
  params = {}
) {
  return {
    type,
    params
  };
}