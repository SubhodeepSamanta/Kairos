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
  const ariaRole = element.ariaRole || null;
  const actionHints = [];

  if (source === "inputs") actionHints.push("type");
  if (source === "buttons" || source === "links") actionHints.push("click");

  const textLower = label.toLowerCase();
  if (element.semanticType === "search_input" || element.purpose === "search_input" || textLower.includes("search")) {
    actionHints.push("search");
  }
  if (element.href) actionHints.push("navigate");

  // Use ARIA role to determine semanticType if classifier didn't provide one
  let semanticType = element.semanticType || null;
  let purpose = element.purpose || null;
  if (!semanticType && ariaRole) {
    const ariaToType = {
      searchbox: "search_input",
      textbox: "input_element",
      button: "action_target",
      link: "navigation_element",
      combobox: "search_input",
      heading: "content_header",
      img: "visual_content",
      listbox: "selection_list",
      option: "selection_candidate",
      tab: "navigation_element",
      menuitem: "navigation_element"
    };
    semanticType = ariaToType[ariaRole] || null;
  }
  if (!purpose && ariaRole) {
    const ariaToPurpose = {
      searchbox: "search_input",
      button: "action_target",
      link: "navigation_target"
    };
    purpose = ariaToPurpose[ariaRole] || null;
  }

  return {
    id: element.id,
    source,
    role,
    label,
    href: element.href,
    visible: element.visible !== false,
    disabled: element.disabled === true,
    semanticType,
    purpose,
    value: element.value,
    confidence: typeof element.confidence === "number" ? element.confidence : 0.75,
    position: index,
    inViewport: element.inViewport ?? null,
    top: element.top ?? null,
    left: element.left ?? null,
    width: element.width ?? null,
    height: element.height ?? null,
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

  // 1. Check for modal/overlay constraints
  const closeBtn = (browser.buttons || []).some(btn => 
    btn.purpose === "confirmation_action" || 
    (btn.text && /close|dismiss|reject|accept/i.test(btn.text))
  );
  if (closeBtn && (/cookie|consent|privacy|agree/i.test(pageText) || /sign in to/i.test(pageText))) {
    return "modal flow";
  }

  // 2. Content access flow (remove platform-specific naming)
  const hasInteractiveElements = (browser.inputs || []).length > 0 || 
    (browser.buttons || []).length > 0 || 
    (browser.links || []).length > 0;

  // 3. User input opportunities
  const hasSearchIntent = elements.some(el => 
    el.semanticType === "search_input" || 
    el.purpose === "search_input" ||
    el.actionHints.includes("search") ||
    /search|query|find|lookup/i.test(el.label || "")
  );

  const hasNavigationOptions = elements.some(el => 
    el.semanticType === "navigation_element" ||
    el.actionHints.includes("navigate") ||
    el.actionHints.includes("click") ||
    /home|profile|menu|navigation/i.test(el.label || "")
  );

  const hasContentItems = elements.some(el => 
    el.purpose === "primary_content" ||
    /read|view|watch|play|consume|article|post|item/i.test(el.label || "")
  );

  const hasActionButtons = elements.some(el => 
    el.purpose === "action_target" ||
    /submit|continue|next|proceed|go|start/i.test(el.label || "")
  );

  const hasFormInputElements = elements.some(el => 
    el.purpose === "input_element" ||
    (browser.inputs || []).length > 0
  );

  // Semantic classification based on user interaction patterns

  if (hasPasswordInput || /credential|authentication|access|sign|log in/i.test(title) || /login|signin|auth|protected/i.test(url)) {
    return "access_control";
  }

  if (hasSearchIntent && hasNavigationOptions && hasContentItems) {
    return "search_workflow";
  }

  if (hasNavigationOptions && hasContentItems) {
    return "content_navigation";
  }

  if (hasContentItems) {
    return "content_delivery";
  }

  if (hasFormInputElements && hasActionButtons) {
    return "data_interaction";
  }

  if (hasActionButtons && hasSearchIntent) {
    return "search_interface";
  }

  if (hasInteractiveElements) {
    if (hasSearchIntent) {
      return "search_task";
    }
    if (hasContentItems && hasNavigationOptions) {
      return "navigation_task";
    }
    if (hasFormInputElements) {
      return "form_interaction";
    }
    if (hasActionButtons) {
      return "action_based";
    }
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
  if (pagePurpose === "search_workflow") {
    workflows.push("content_discovery");
  }
  if (pagePurpose === "access_control") {
    workflows.push("authentication");
  }
  if (pagePurpose === "data_interaction") {
    workflows.push("data_management");
  }
  if (pagePurpose === "content_navigation") {
    workflows.push("resource_access");
  }
  if (pagePurpose === "content_delivery") {
    workflows.push("information_consumption");
  }
  if (pagePurpose === "action_based") {
    workflows.push("user_action_execution");
  }
  if (pagePurpose === "search_interface") {
    workflows.push("query_execution");
  }
  if (pagePurpose === "navigation_task") {
    workflows.push("environment_exploration");
  }
  if (pagePurpose === "form_interaction") {
    workflows.push("interaction_flow");
  }
  return workflows;
}

function collectConstraints(browser = {}) {
  const constraints = [];
  const text = `${browser.title || ""} ${browser.text || ""}`.toLowerCase();

  if ((browser.inputs || []).some(input => input.type === "password")) {
    constraints.push({ type: "access_control_required", reason: "authentication credentials needed" });
  }
  if (/captcha|verify you are human|human verification/.test(text)) {
    constraints.push({ type: "interaction_verification", reason: "human verification required for security" });
  }
  if (/cookie|consent|privacy|terms/.test(text) && (browser.buttons || []).some(button => /accept|reject|close|dismiss|agree|ok/i.test(textOf(button)))) {
    constraints.push({ type: "initial_barrier", reason: "terms/acceptance barrier before use" });
  }
  if (!browser.url || browser.url === "about:blank") {
    constraints.push({ type: "no_active_content", reason: "browser environment inactive" });
  }

  return constraints;
}

function collectRisks(browser = {}) {
  const risks = [];
  const text = `${browser.title || ""} ${browser.text || ""}`.toLowerCase();

  if (/payment|billing|credit card|debit|wallet|purchase|checkout|pay|price/i.test(text)) {
    risks.push({ type: "financial_involvement", reason: "financial transaction potential" });
  }
  if (/cancel|delete|remove|erase|suspend|deactivate|quit|logout/i.test(text)) {
    risks.push({ type: "state_change", reason: "permanent state modification risk" });
  }
  if (/mfa|multi-factor|verification|code|security|confirm|authenticate|otp/i.test(text)) {
    risks.push({ type: "identity_verification", reason: "additional security verification required" });
  }

  return risks;
}

function extractEntities(browser, elements) {
  const entities = [];
  const text = browser.text || "";
  
  // Extract possible financial values
  const financialMatch = text.match(/\$\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*(?:USD|EUR|GBP)/g);
  if (financialMatch) {
    financialMatch.forEach(value => entities.push({ type: "price", value: value }));
  }

  // Extract numerical counts or metrics
  const countMatch = text.match(/(\d+(?:\.\d+)?k?)\s*(?:total|count|items?|users?|views?|pageviews?|repo)\b/i);
  if (countMatch) {
    entities.push({ type: "metric_count", value: countMatch[1] });
  }

  // Extract date/time references
  const dateMatch = text.match(/(?:by|deadline|due|on)\s+([A-Za-z]+ \d{1,2}(?:,? \d{4})?)/i);
  if (dateMatch) {
    entities.push({ type: "deadline", value: dateMatch[1] });
  }

  // Extract interface elements
  const interfaceMatch = text.match(/(?:username|email|password|login|sign in|sign up|register)/i);
  if (interfaceMatch) {
    entities.push({ type: "interface_element", value: interfaceMatch[0] });
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
