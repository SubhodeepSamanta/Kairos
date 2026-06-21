import { resolveCurrentState } from "./currentStateResolver.js";

function textOf(element = {}) {
  return [
    element.text,
    element.label,
    element.name,
    element.ariaLabel,
    element.title,
    element.placeholder,
    element.value
  ].filter(Boolean).join(" ").trim();
}

function normalizeElement(element = {}, source = "element", index = 0) {
  const label = textOf(element);
  const role = element.role || element.type || source;
  const actionHints = [];

  if (source === "inputs") actionHints.push("type");
  if (source === "buttons" || source === "links") actionHints.push("click");
  if (element.semanticType === "search_input" || element.purpose === "search_input") actionHints.push("search");
  if (element.href) actionHints.push("navigate");

  return {
    id: element.id,
    source,
    role,
    label,
    href: element.href,
    visible: element.visible !== false,
    disabled: element.disabled === true,
    semanticType: element.semanticType || null,
    purpose: element.purpose || null,
    value: element.value,
    confidence: typeof element.confidence === "number" ? element.confidence : 0.75,
    position: index,
    actionHints: [...new Set(actionHints)]
  };
}

function collectImportantElements(browser = {}) {
  const groups = [
    ["inputs", browser.inputs || []],
    ["buttons", browser.buttons || []],
    ["links", browser.links || []]
  ];

  return groups.flatMap(([source, elements]) =>
    elements
      .map((element, index) => normalizeElement(element, source, index))
      .filter(element => element.id && element.visible && !element.disabled)
  );
}

function inferPagePurpose(resolvedState, browser = {}) {
  if (resolvedState.currentState === "blank") return "empty_workspace";
  if (resolvedState.currentState === "home") return "starting_point";
  if (resolvedState.currentState === "results") return "choice_list";
  if (resolvedState.currentState === "login") return "authentication";
  if (resolvedState.currentState === "settings") return "configuration";
  if ((browser.inputs || []).length > 2 && (browser.buttons || []).length > 0) return "data_entry";
  if ((browser.links || []).length > 5) return "navigation_or_selection";
  return "content_review";
}

function collectActions(elements) {
  const actions = [];
  for (const element of elements) {
    for (const hint of element.actionHints) {
      actions.push({
        type: hint,
        elementId: element.id,
        label: element.label,
        role: element.role,
        reason: `${hint} ${element.label || element.role}`.trim()
      });
    }
  }

  actions.push({ type: "read_ui", reason: "refresh page observation" });
  actions.push({ type: "back", reason: "return to previous page" });
  actions.push({ type: "scroll", direction: "down", reason: "reveal more available controls" });
  return actions;
}

function collectEntities(browser = {}, elements = []) {
  const textEntities = (browser.entities || []).map(entity => ({
    type: entity.type || "unknown",
    name: entity.name || entity.text || "",
    source: "observer"
  })).filter(entity => entity.name);

  const elementEntities = elements
    .filter(element => element.label && element.label.length > 2)
    .slice(0, 20)
    .map(element => ({
      type: element.role || "element",
      name: element.label,
      source: element.source,
      elementId: element.id
    }));

  return [...textEntities, ...elementEntities];
}

function collectConstraints(browser = {}) {
  const constraints = [];
  const text = `${browser.title || ""} ${browser.text || ""}`.toLowerCase();

  if ((browser.inputs || []).some(input => input.type === "password")) {
    constraints.push({ type: "credential_required", reason: "password input is present" });
  }
  if (/captcha|verify you are human/.test(text)) {
    constraints.push({ type: "human_verification_required", reason: "human verification text detected" });
  }
  if (/cookie|consent|privacy/.test(text) && (browser.buttons || []).some(button => /accept|reject|close|dismiss/i.test(textOf(button)))) {
    constraints.push({ type: "blocking_prompt_possible", reason: "consent or privacy prompt may need dismissal" });
  }
  if (!browser.url || browser.url === "about:blank") {
    constraints.push({ type: "no_active_page", reason: "browser has no navigable page loaded" });
  }

  return constraints;
}

export function understandPage(observation, previousResolvedState = null) {
  const browser = observation?.pageState || observation || {};
  const resolvedState = resolveCurrentState(browser, previousResolvedState);
  const importantElements = collectImportantElements(browser);
  const pagePurpose = inferPagePurpose(resolvedState, browser);
  const availableActions = collectActions(importantElements);
  const entities = collectEntities(browser, importantElements);
  const constraints = collectConstraints(browser);

  return {
    pagePurpose,
    pageSummary: {
      title: browser.title || "",
      url: browser.url || "",
      platform: resolvedState.platform,
      state: resolvedState.currentState,
      semanticState: resolvedState.semanticState,
      elementCounts: {
        inputs: (browser.inputs || []).length,
        buttons: (browser.buttons || []).length,
        links: (browser.links || []).length
      }
    },
    availableActions,
    importantElements,
    entities,
    constraints,
    resolvedState
  };
}
