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
  
  const textLower = label.toLowerCase();
  if (element.semanticType === "search_input" || element.purpose === "search_input" || textLower.includes("search")) {
    actionHints.push("search");
  }
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

function inferPagePurpose(resolvedState, browser = {}, elements = []) {
  const url = (browser.url || "").toLowerCase();
  const title = (browser.title || "").toLowerCase();
  const pageText = (browser.text || "").toLowerCase();
  const hasPasswordInput = (browser.inputs || []).some(input => input.type === "password");

  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch (e) {}

  const closeBtn = (browser.buttons || []).some(btn => 
    btn.purpose === "close_button" || 
    (btn.text && /close|dismiss|reject|accept/i.test(btn.text))
  );
  if (closeBtn && (/cookie|consent|privacy|agree/i.test(pageText) || /sign in to/i.test(pageText))) {
    return "modal flow";
  }

  if (resolvedState.currentState === "login" || hasPasswordInput || /login|signin|sign-in|auth|register|signup/i.test(pathname) || /sign in|log in|create account/i.test(title)) {
    return "login flow";
  }

  const isSearchUrl = /\/search|\/results|[?&](q|query|search_query)=/.test(url);
  if (resolvedState.currentState === "results" || isSearchUrl || /search/i.test(title)) {
    return "search results";
  }

  if (resolvedState.currentState === "content" && (url.includes("/watch") || url.includes("/shorts") || /video|play/i.test(title) || (browser.capabilities || []).includes("media_available"))) {
    return "video player";
  }

  if (/checkout|payment|cart|basket/i.test(pathname) || /checkout|payment|cart/i.test(title) || elements.some(e => e.semanticType === "checkout_action" || /checkout|buy|pay/i.test(e.label))) {
    return "checkout";
  }

  if (resolvedState.currentState === "settings" || /settings|preferences|config/i.test(pathname) || /settings|preferences/i.test(title)) {
    return "settings";
  }

  if (/profile|account|my-account/i.test(pathname) || /profile|my account/i.test(title)) {
    return "profile";
  }

  if (elements.some(e => e.semanticType === "repository_item" || e.purpose === "repository_link" || e.semanticType === "product_item")) {
    return "catalog";
  }

  if (/dashboard|feed/i.test(url) || /dashboard|console/i.test(title)) {
    return "dashboard";
  }

  const inputCount = (browser.inputs || []).length;
  if (inputCount >= 3) {
    return "form";
  }

  if (/wiki|article|post|blog/i.test(url) || pageText.length > 1000) {
    return "article";
  }

  if (resolvedState.currentState === "home" || (browser.inputs || []).some(input => input.purpose === "search_input")) {
    return "search interface";
  }

  return "generic";
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
        semanticType: element.semanticType,
        purpose: element.purpose,
        href: element.href,
        reason: `${hint} ${element.label || element.role}`.trim()
      });
    }
  }

  actions.push({ type: "read_ui", reason: "refresh page observation" });
  actions.push({ type: "back", reason: "return to previous page" });
  actions.push({ type: "scroll", direction: "down", reason: "reveal more available controls" });
  return actions;
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

function generateSummary(browser, resolvedState, purpose) {
  const inputsCount = (browser.inputs || []).length;
  const buttonsCount = (browser.buttons || []).length;
  const linksCount = (browser.links || []).length;
  const platform = resolvedState.capabilities && resolvedState.capabilities.length > 0 
    ? resolvedState.capabilities[0] 
    : (resolvedState.platform || "generic");
  return `Page titled "${browser.title || "Untitled"}" on platform "${platform}" classified as "${purpose}". It exposes ${inputsCount} inputs, ${buttonsCount} buttons, and ${linksCount} links.`;
}

export function understandPage(observation, previousResolvedState = null) {
  const browser = observation?.pageState || observation || {};
  const resolvedState = resolveCurrentState(browser, previousResolvedState);
  const importantElements = collectImportantElements(browser);
  const pagePurpose = inferPagePurpose(resolvedState, browser, importantElements);
  const pageSummary = generateSummary(browser, resolvedState, pagePurpose);
  const availableActions = collectActions(importantElements);
  const constraints = collectConstraints(browser);

  const hasPurpose = pagePurpose !== "generic";
  const confidence = hasPurpose ? 0.90 : 0.60;

  return {
    pagePurpose,
    pageSummary,
    availableActions,
    importantElements,
    constraints,
    confidence,
    resolvedState
  };
}
