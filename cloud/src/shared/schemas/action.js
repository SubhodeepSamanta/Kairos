export const ACTIONS = {
  OPEN_APP: "open_app",
  CLICK: "click",
  TYPE: "type",
  NAVIGATE: "navigate",
  READ_UI: "read_ui"
};

export function createAction(type, params = {}) {
  return {
    type,
    params
  };
}