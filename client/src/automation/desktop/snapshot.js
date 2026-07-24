const ACTABLE = {
  invoke: "click",
  value: "type",
  toggle: "toggle",
  expandcollapse: "menu",
  selectionitem: "select"
};

function actionHint(patterns) {
  const hints = [];
  for (const p of patterns) if (ACTABLE[p] && !hints.includes(ACTABLE[p])) hints.push(ACTABLE[p]);
  return hints.join("/");
}

export function formatDesktopSnapshot({ window, elements } = {}) {
  if (!window && (!elements || !elements.length)) {
    return "DESKTOP: no window is in focus, or it exposes no readable elements. open_app or focus_app first, then read_desktop.";
  }
  const lines = [];
  lines.push(`DESKTOP WINDOW: ${window?.title || "unknown"}${window?.app ? ` (${window.app})` : ""}`);
  if (!elements || !elements.length) {
    lines.push("ELEMENTS: none readable — the app may draw its own UI (no accessibility tree). If you must act, read_desktop again; if still empty this app is not controllable this way.");
    return lines.join("\n");
  }
  lines.push(`ELEMENTS (${elements.length}):`);
  for (const el of elements) {
    const parts = [`[${el.id}]`, el.control];
    if (el.name) parts.push(`"${el.name.slice(0, 60)}"`);
    const hint = actionHint(el.patterns);
    if (hint) parts.push(`(${hint})`);
    if (!el.enabled) parts.push("(disabled)");
    lines.push(parts.join(" "));
  }
  return lines.join("\n");
}
