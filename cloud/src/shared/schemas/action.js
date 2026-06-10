export const ACTIONS = {
  OPEN_APP: "open_app",
  CLOSE_APP: "close_app",
  FOCUS_APP: "focus_app",
  CLICK: "click",
  TYPE: "type",
  NAVIGATE: "navigate",
  READ_UI: "read_ui",
  CLOSE_BROWSER:
  "close_browser",
  BACK: "back",
  FORWARD: "forward",
  CLOSE_TAB:
  "close_tab",
  LIST_TABS: "list_tabs",
  NEW_TAB: "new_tab",
  SWITCH_TAB:
  "switch_tab",
  REFRESH: "refresh",
  RESTART_BROWSER:
    "restart_browser",
  GET_BROWSER_CONTEXT: "get_browser_context"
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