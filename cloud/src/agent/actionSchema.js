const SCHEMA = {
  navigate: { url: "url" },
  click: { id: "id" },
  type: { id: "id", text: "text" },
  select_option: { id: "id", value: "text" },
  press_key: { key: "text" },
  scroll: {},
  back: {},
  refresh: {},
  new_tab: {},
  new_window: {},
  switch_tab: { index: "number" },
  close_tab: {},
  read: {},
  wait: {},
  screenshot: {},
  list_browsers: {},
  use_browser: { browser: "text" },
  open_for_user: { url: "url" },
  close_user_browser: {},
  web_search: { query: "text" },
  fetch_page: { url: "url" },
  weather: {},
  remember: { key: "text", value: "text" },
  ask_human: { question: "text" },
  done: {},
  list_files: {},
  read_file: { path: "text" },
  write_file: { path: "text", text: "text" },
  list_apps: {},
  open_app: { app: "text" },
  focus_app: { app: "text" },
  close_app: { app: "text" }
};

function badValue(kind, value) {
  if (value === undefined || value === null) return "missing";
  if (kind === "id" || kind === "number") {
    return Number.isFinite(Number(value)) ? null : `must be a number, got ${JSON.stringify(value)}`;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return `must be text, got ${JSON.stringify(value).slice(0, 40)}`;
  }
  if (!String(value).trim()) return "is empty";
  if (kind === "url" && !/^https?:\/\/|^[\w.-]+\.[a-z]{2,}/i.test(String(value).trim())) {
    return `does not look like a url: ${JSON.stringify(value).slice(0, 40)}`;
  }
  return null;
}

export function knownActionTypes() {
  return Object.keys(SCHEMA);
}

export function validateAction(action) {
  if (!action || typeof action !== "object") {
    return "Your reply had no action object. Follow the response format exactly.";
  }
  const type = action.type;
  if (typeof type !== "string" || !type.trim()) {
    return "Your action had no \"type\". Follow the response format exactly.";
  }
  const shape = SCHEMA[type];
  if (!shape) {
    return `Unknown action type "${type}". Use only the documented actions.`;
  }

  const problems = [];
  for (const [field, kind] of Object.entries(shape)) {
    const problem = badValue(kind, action[field]);
    if (problem) problems.push(`"${field}" ${problem}`);
  }
  if (!problems.length) return null;
  return `Your ${type} action was malformed: ${problems.join("; ")}. Send it again, correctly, in one JSON object.`;
}
