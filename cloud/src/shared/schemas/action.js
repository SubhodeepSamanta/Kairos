export const ACTIONS = {
  OPEN_APP: "open_app",
  CLOSE_APP: "close_app",
  FOCUS_APP: "focus_app",
  CLICK: "click",
  TYPE: "type",
  NAVIGATE: "navigate",
  READ_UI: "read_ui"
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