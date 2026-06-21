import { parseGoal } from "./goalUnderstanding.js";
import { extractAffordances } from "./affordanceExtractor.js";

function resolveDomain(platformName) {
  const p = platformName.toLowerCase().trim();
  if (p === "wikipedia") return "https://wikipedia.org";
  return `https://${p}.com`;
}

function extractQueryTerm(parsedGoal, goalText) {
  const text = goalText.trim();
  
  // Pattern 1: search [platform] for <query>
  const matchFor = text.match(/search\s+(?:[a-z0-9\-]+\s+)?for\s+(.+?)(?:\s+on\s+[a-z0-9\-]+|\s+in\s+[a-z0-9\-]+|\s+and|$)/i);
  if (matchFor && matchFor[1]) {
    let clean = matchFor[1].trim();
    return clean.replace(/\s+(video|song|media|content|channel|playlist|music)$/i, "").trim();
  }

  // Pattern 2: search <query> on/in [platform]
  const matchOn = text.match(/search\s+(.+?)\s+on\s+[a-z0-9\-]+/i);
  if (matchOn && matchOn[1]) {
    let clean = matchOn[1].trim();
    return clean.replace(/\s+(video|song|media|content|channel|playlist|music)$/i, "").trim();
  }

  // Pattern 3: play [latest/newest/first] [video/song/media/content] [of/by] <query>
  const matchPlay = text.match(/play\s+(?:first\s+|latest\s+|newest\s+)?(?:video\s+of\s+|song\s+of\s+|media\s+content\s+of\s+|music\s+by\s+)?(.+?)(?:\s+on\s+[a-z0-9\-]+|$)/i);
  if (matchPlay && matchPlay[1]) {
    let clean = matchPlay[1].trim();
    return clean.replace(/\s+(video|song|media|content|channel|playlist|music)$/i, "").trim();
  }

  // Fallback: use parsedGoal constraints that aren't platforms
  if (parsedGoal.platform) {
    const nonPlat = parsedGoal.constraints.filter(c => c !== parsedGoal.platform && c !== "latest");
    if (nonPlat.length > 0) return nonPlat[0];
  } else {
    const nonLatest = parsedGoal.constraints.filter(c => c !== "latest");
    if (nonLatest.length > 0) return nonLatest[0];
  }

  return text;
}

function deriveAffordancesFromImportantElements(importantElements) {
  const clickable = [];
  const typeable = [];
  const selectable = [];
  const expandable = [];
  const navigable = [];
  const downloadable = [];

  for (const el of importantElements) {
    if (el.actionHints?.includes("type")) typeable.push(el);
    if (el.actionHints?.includes("click")) clickable.push(el);
    if (el.actionHints?.includes("navigate")) navigable.push(el);
    const textLower = (el.label || "").toLowerCase();
    if (textLower.includes("select") || textLower.includes("option")) selectable.push(el);
    if (textLower.includes("menu") || textLower.includes("expand") || textLower.includes("dropdown")) expandable.push(el);
    if (textLower.includes("download") || textLower.includes("export")) downloadable.push(el);
  }

  return { clickable, typeable, selectable, expandable, navigable, downloadable };
}

export function generateActions(goal, pageUnderstanding, browserState) {
  const candidates = [];
  const browser = browserState || {};
  const currentUrl = (browser.url || "").toLowerCase();
  
  // 1. Goal & Affordance Understanding
  const parsedGoal = parseGoal(goal);
  const affordances = pageUnderstanding?.importantElements?.length
    ? deriveAffordancesFromImportantElements(pageUnderstanding.importantElements)
    : extractAffordances(browser);

  // 2. Navigation Actions
  // Check if any platform constraints are mentioned in the goal and if we are not already on that platform
  if (parsedGoal.platform && !currentUrl.includes(parsedGoal.platform)) {
    const domainUrl = resolveDomain(parsedGoal.platform);
    candidates.push({
      type: "navigate",
      actions: [{ type: "navigate", params: { url: domainUrl } }],
      label: `Navigate to ${parsedGoal.platform}`,
      reason: `Objective requires platform: ${parsedGoal.platform}`
    });
  }

  // Check for explicit URL in the goal
  const urlMatch = goal.match(/https?:\/\/[^\s]+/i);
  if (urlMatch && urlMatch[0]) {
    const targetUrl = urlMatch[0];
    if (!currentUrl.includes(targetUrl.toLowerCase())) {
      candidates.push({
        type: "navigate",
        actions: [{ type: "navigate", params: { url: targetUrl } }],
        label: `Navigate to ${targetUrl}`,
        reason: "Goal specifies explicit destination URL"
      });
    }
  }

  // Fallback default navigation if we are blank
  if ((!currentUrl || currentUrl === "about:blank") && candidates.length === 0) {
    candidates.push({
      type: "navigate",
      actions: [{ type: "navigate", params: { url: "https://www.google.com" } }],
      label: "Navigate to search engine gateway",
      reason: "Blank page - default to standard search gateway"
    });
  }

  // 3. Typable & Search Actions
  const queryTerm = extractQueryTerm(parsedGoal, goal);
  affordances.typeable.forEach(element => {
    // Generate simple typing action
    candidates.push({
      type: "type",
      actions: [{ type: "type", params: { element: element.id, text: queryTerm } }],
      elementId: element.id,
      label: `Type "${queryTerm}" in ${element.label || element.role || "input"}`,
      purpose: element.purpose,
      semanticType: element.semanticType,
      reason: "Type target query into available input field"
    });

    // Generate search action (type + Enter)
    candidates.push({
      type: "search",
      actions: [
        { type: "type", params: { element: element.id, text: queryTerm } },
        { type: "press_key", params: { key: "Enter" } },
        { type: "read_ui", params: {} }
      ],
      elementId: element.id,
      label: `Search for "${queryTerm}" using ${element.label || element.role || "input"}`,
      purpose: element.purpose,
      semanticType: element.semanticType,
      reason: "Submit search query via input field Enter press"
    });
  });

  const searchLaunchers = (pageUnderstanding?.importantElements || [])
    .filter(el => el.source === "buttons" && /search|jump to/i.test(el.label || ""));

  searchLaunchers.forEach(element => {
    candidates.push({
      type: "type",
      actions: [
        { type: "click", params: { element: element.id } },
        { type: "type", params: { element: element.id, text: queryTerm } },
        { type: "press_key", params: { key: "Enter" } },
        { type: "read_ui", params: {} }
      ],
      elementId: element.id,
      label: `Open and search via launcher: ${element.label || element.id}`,
      purpose: element.purpose,
      semanticType: element.semanticType,
      reason: "Click search launcher button to reveal input, then type and submit query"
    });
  });

  // 4. Clickable / Selectable / Expandable Actions
  affordances.clickable.forEach(element => {
    candidates.push({
      type: "click",
      actions: [{ type: "click", params: { element: element.id } }, { type: "read_ui", params: {} }],
      elementId: element.id,
      label: element.label || `element:${element.id}`,
      purpose: element.purpose,
      semanticType: element.semanticType,
      href: element.href,
      role: element.role,
      reason: `Click interaction on ${element.label || element.role || "button"}`
    });
  });

  affordances.selectable.forEach(element => {
    candidates.push({
      type: "click",
      actions: [{ type: "click", params: { element: element.id } }, { type: "read_ui", params: {} }],
      elementId: element.id,
      label: `Select option: ${element.label || element.id}`,
      purpose: element.purpose,
      semanticType: element.semanticType,
      reason: "Select target menu option"
    });
  });

  affordances.expandable.forEach(element => {
    candidates.push({
      type: "click",
      actions: [{ type: "click", params: { element: element.id } }, { type: "read_ui", params: {} }],
      elementId: element.id,
      label: `Expand control: ${element.label || element.id}`,
      purpose: element.purpose,
      semanticType: element.semanticType,
      reason: "Expand hidden container/menu options"
    });
  });

  // 5. Extraction Actions
  if (parsedGoal.objective === "extract_information") {
    let cleanQuery = goal;
    const match = goal.match(/(?:extract|get|find|retrieve|read)\s+(.+)/i);
    if (match && match[1]) {
      cleanQuery = match[1].trim();
    }
    candidates.push({
      type: "extract",
      actions: [{ type: "extract_data", params: { query: cleanQuery } }],
      label: `Extract information: ${cleanQuery}`,
      reason: "Objective requests data extraction from current view"
    });
  }

  // 6. Navigation Primitive Actions
  candidates.push({
    type: "scroll",
    actions: [{ type: "scroll", params: { direction: "down", amount: 300 } }, { type: "read_ui", params: {} }],
    label: "Scroll down",
    reason: "Examine more page elements"
  });

  candidates.push({
    type: "back",
    actions: [{ type: "back", params: {} }, { type: "read_ui", params: {} }],
    label: "Go back",
    reason: "Return to previous page state"
  });

  candidates.push({
    type: "read_ui",
    actions: [{ type: "read_ui", params: {} }],
    label: "Refresh observation",
    reason: "Re-observe page content"
  });

  return candidates;
}
