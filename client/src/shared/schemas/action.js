export const ACTIONS = {
  OPEN_APP: "open_app",
  CLOSE_APP: "close_app",
  FOCUS_APP: "focus_app",
  CLICK: "click",
  TYPE: "type",
  NAVIGATE: "navigate",
  READ_UI: "read_ui",
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