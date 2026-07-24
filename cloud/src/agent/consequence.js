const IRREVERSIBLE = [
  {
    kind: "spend money",
    words: ["buy", "buy now", "purchase", "place order", "place your order", "pay", "pay now", "checkout", "check out", "complete purchase", "confirm payment", "confirm order", "subscribe", "start subscription", "donate", "bid", "book now", "reserve"]
  },
  {
    kind: "delete something",
    words: ["delete", "delete account", "delete forever", "permanently delete", "remove", "erase", "wipe", "deactivate", "close account", "unsubscribe", "cancel subscription", "cancel membership", "empty trash", "discard"]
  },
  {
    kind: "send something to other people",
    words: ["send", "send message", "send email", "send now", "reply", "reply all", "post", "publish", "tweet", "share", "submit post", "comment", "confirm and send"]
  }
];

const AFFIRMATIVE = /^\s*(y|ye|yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|confirm|confirmed|please do|proceed|affirmative|correct|right)\b/i;
const NEGATIVE = /^\s*(n|no|nope|nah|don'?t|do not|stop|cancel|abort|never mind|nevermind|wait)\b/i;

function normalize(label) {
  return String(label || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchVerb(label) {
  const clean = normalize(label);
  if (!clean) return null;
  for (const group of IRREVERSIBLE) {
    for (const word of group.words) {
      if (clean === word) return group;
      if (new RegExp(`(^|\\s)${word}(\\s|$)`).test(clean)) return group;
    }
  }
  return null;
}

export function labelFor(id, page) {
  if (!page || id === undefined || id === null) return null;
  const groups = [page.buttons, page.inputs, page.links];
  for (const group of groups || []) {
    for (const el of group || []) {
      if (String(el.id) !== String(id)) continue;
      return String(el.text || el.ariaLabel || el.name || el.placeholder || "").trim() || null;
    }
  }
  return null;
}

export function desktopLabelFor(id, desktop) {
  if (!desktop || !Array.isArray(desktop.elements) || id === undefined || id === null) return null;
  for (const el of desktop.elements) {
    if (String(el.id) !== String(id)) continue;
    return String(el.name || "").trim() || null;
  }
  return null;
}

export function classifyConsequence(action, page, desktop = null) {
  if (!action || typeof action !== "object") return null;

  if (action.type === "type" && action.submit === true && /\{\{secret:/.test(String(action.text || ""))) {
    return { kind: "sign in with a saved password", what: labelFor(action.id, page) || "that form" };
  }

  if (action.type === "type_into" && action.submit === true && /\{\{secret:/.test(String(action.text || ""))) {
    return { kind: "sign in with a saved password", what: desktopLabelFor(action.id, desktop) || "that field" };
  }

  if (action.type === "click_element") {
    const label = desktopLabelFor(action.id, desktop);
    if (!label) return null;
    const group = matchVerb(label);
    return group ? { kind: group.kind, what: `"${label}"` } : null;
  }

  if (action.type === "close_app") {
    const title = String(desktop?.window?.title || "");
    if (/[*]|\bunsaved\b|save changes/i.test(title)) {
      return { kind: "close an app with unsaved changes", what: `"${title.slice(0, 60)}"` };
    }
    return null;
  }

  if (action.type === "press_keys") {
    const keys = String(action.keys || "").toLowerCase();
    const app = normalize(desktop?.window?.app);
    const title = normalize(desktop?.window?.title);
    const destructive = /(^|\+|\s)del(ete)?(\+|\s|$)/.test(keys);
    const fileManager = app.includes("explorer") || title.includes("file explorer");
    if (destructive && fileManager) return { kind: "delete files", what: "the selected items in File Explorer" };
    return null;
  }

  if (action.type !== "click") return null;
  const label = labelFor(action.id, page);
  if (!label) return null;
  const group = matchVerb(label);
  if (!group) return null;
  return { kind: group.kind, what: `"${label}"` };
}

export function confirmationQuestion(consequence, page) {
  const where = page?.url ? ` on ${String(page.url).replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}` : "";
  return `I'm about to ${consequence.kind}${where} — ${consequence.what}. Do you want me to?`;
}

export function readsAsYes(answer) {
  const text = String(answer ?? "").trim();
  if (!text) return false;
  if (NEGATIVE.test(text)) return false;
  return AFFIRMATIVE.test(text);
}
