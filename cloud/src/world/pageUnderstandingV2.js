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
    inViewport: element.inViewport ?? null,
    top: element.top ?? null,
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

  // 1. Check for modal/overlay constraints
  const closeBtn = (browser.buttons || []).some(btn => 
    btn.purpose === "confirmation_action" || 
    (btn.text && /close|dismiss|reject|accept/i.test(btn.text))
  );
  if (closeBtn && (/cookie|consent|privacy|agree/i.test(pageText) || /sign in to/i.test(pageText))) {
    return "modal flow";
  }

  // 2. Authentication/login flow
  if (resolvedState.currentState === "login" || hasPasswordInput || /login|signin|sign-in|auth|register|signup/i.test(pathname) || /sign in|log in|create account/i.test(title)) {
    return "login flow";
  }

  // 3. Search results
  const isSearchUrl = /\/search|\/results|[?&](q|query|search_query)=/.test(url);
  const hasResultElements = elements.some(e => 
    e.semanticType === "content_item" || 
    e.semanticType === "selection_candidate" ||
    e.purpose === "primary_content"
  );
  if (resolvedState.currentState === "results" || (isSearchUrl && hasResultElements) || (title.includes("results") && hasResultElements)) {
    return "search results";
  }

  // 4. Media player / Video content
  if (resolvedState.currentState === "content" && (url.includes("/watch") || url.includes("/shorts") || /video|play|media|stream/i.test(title) || (browser.capabilities || []).includes("media_available"))) {
    return "media content";
  }

  // 5. Product detail
  if (elements.some(e => e.semanticType === "product_item" || /price|buy|add to cart|checkout/i.test(e.label)) && /detail|product|dp/i.test(pathname)) {
    return "product detail";
  }

  // 6. Settings
  if (resolvedState.currentState === "settings" || /settings|preferences|config/i.test(pathname) || /settings|preferences/i.test(title)) {
    return "settings";
  }

  // 7. Profile
  if (/profile|account|my-account/i.test(pathname) || /profile|my account/i.test(title)) {
    return "profile";
  }

  // 8. Resource detail (Repository details, etc.)
  if (elements.some(e => e.semanticType === "repository_item" || e.purpose === "primary_content") || /repo|details/i.test(pathname)) {
    return "resource detail";
  }

  // 9. Dashboard
  if (/dashboard|feed/i.test(url) || /dashboard|console/i.test(title)) {
    return "dashboard";
  }

  // 10. Form
  const inputCount = (browser.inputs || []).length;
  if (inputCount >= 3) {
    return "form";
  }

  // 11. Article
  if (/wiki|article|post|blog/i.test(url) || pageText.length > 1000) {
    return "article";
  }

  // 12. Search interface
  if (resolvedState.currentState === "home" || (browser.inputs || []).some(input => input.purpose === "search_input")) {
    return "search interface";
  }

  return "generic";
}

function collectAvailableActions(elements) {
  const actions = [];
  for (const element of elements) {
    for (const hint of element.actionHints) {
      actions.push(`${hint}:${element.id}`);
    }
  }
  return actions;
}

function detectWorkflows(pagePurpose, elements) {
  const workflows = [];
  if (pagePurpose === "search interface" || pagePurpose === "search results") {
    workflows.push("search_and_select");
  }
  if (pagePurpose === "login flow") {
    workflows.push("authenticate");
  }
  if (pagePurpose === "form") {
    workflows.push("data_entry");
  }
  if (pagePurpose === "media content") {
    workflows.push("media_playback");
  }
  if (pagePurpose === "product detail") {
    workflows.push("purchase_flow");
  }
  return workflows;
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

function collectRisks(browser = {}) {
  const risks = [];
  const text = `${browser.title || ""} ${browser.text || ""}`.toLowerCase();

  if (/credit card|debit card|billing|payment|pay now|checkout|purchase|buy now/i.test(text)) {
    risks.push({ type: "payment_action", reason: "financial checkout page or payment input fields detected" });
  }
  if (/delete|remove|erase|cancel subscription|deactivate/i.test(text)) {
    risks.push({ type: "destructive_action", reason: "destructive command word or delete action option detected" });
  }
  if (/mfa|two-factor|otp|verification code|sent a code/i.test(text)) {
    risks.push({ type: "auth_challenge", reason: "security check or MFA prompt detected" });
  }

  return risks;
}

function extractEntities(browser, elements) {
  const entities = [];
  const text = browser.text || "";
  
  // Extract possible prices
  const priceMatch = text.match(/\$\d+(?:\.\d{2})?/g);
  if (priceMatch) {
    priceMatch.forEach(price => entities.push({ type: "price", value: price }));
  }

  // Extract possible repository stars
  const starsMatch = text.match(/(\d+(?:\.\d+)?k?)\s*stars?/i);
  if (starsMatch) {
    entities.push({ type: "star_count", value: starsMatch[1] });
  }

  // Extract date deadlines
  const deadlineMatch = text.match(/(?:deadline|by)\s+([A-Za-z]+ \d{1,2})/i);
  if (deadlineMatch) {
    entities.push({ type: "deadline", value: deadlineMatch[1] });
  }

  return entities;
}

function generateSummary(browser, resolvedState, purpose) {
  const inputsCount = (browser.inputs || []).length;
  const buttonsCount = (browser.buttons || []).length;
  const linksCount = (browser.links || []).length;
  return `Page titled "${browser.title || "Untitled"}" classified as "${purpose}". It exposes ${inputsCount} inputs, ${buttonsCount} buttons, and ${linksCount} links.`;
}

export function understandPage(observation, previousResolvedState = null) {
  const browser = observation?.pageState || observation || {};
  const resolvedState = resolveCurrentState(browser, previousResolvedState);
  const importantElements = collectImportantElements(browser);
  const pagePurpose = inferPagePurpose(resolvedState, browser, importantElements);
  const pageSummary = generateSummary(browser, resolvedState, pagePurpose);
  const availableActions = collectAvailableActions(importantElements);
  const workflows = detectWorkflows(pagePurpose, importantElements);
  const constraints = collectConstraints(browser);
  const risks = collectRisks(browser);
  const entities = extractEntities(browser, importantElements);

  const hasPurpose = pagePurpose !== "generic";
  const confidence = hasPurpose ? 0.90 : 0.60;

  return {
    pagePurpose,
    summary: pageSummary,
    entities,
    availableActions,
    workflows,
    constraints,
    risks,
    confidence,
    importantElements, // Keep for backward compatibility / reasoner usage
    resolvedState
  };
}
