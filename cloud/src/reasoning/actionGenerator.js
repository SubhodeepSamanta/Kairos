import { extractAffordances } from "./affordanceExtractor.js";

function extractQueryTerm(goalText) {
  const text = goalText.trim();
  const matchFor = text.match(/search\s+(?:for\s+)?(.+?)(?:\s+(?:on|in|and|$))/i);
  if (matchFor && matchFor[1]) {
    return matchFor[1].trim().replace(/\s+(video|song|media|content|channel|playlist|music)$/i, "").trim();
  }
  const matchOn = text.match(/search\s+(.+?)\s+(?:on|in)\s+[a-z0-9\-]+/i);
  if (matchOn && matchOn[1]) {
    return matchOn[1].trim().replace(/\s+(video|song|media|content|channel|playlist|music)$/i, "").trim();
  }
  return text;
}

function deriveAffordancesFromImportantElements(importantElements) {
  const clickable = [];
  const typeable = [];
  const selectable = [];
  const expandable = [];

  for (const el of importantElements) {
    if (el.actionHints?.includes("type")) typeable.push(el);
    if (el.actionHints?.includes("click")) clickable.push(el);
    const textLower = (el.label || "").toLowerCase();
    if (textLower.includes("select") || textLower.includes("option")) selectable.push(el);
    if (textLower.includes("menu") || textLower.includes("expand") || textLower.includes("dropdown")) expandable.push(el);
  }

  return { clickable, typeable, selectable, expandable };
}

export function generateActions(goal, pageUnderstanding, browserState) {
  const candidates = [];
  const browser = browserState || {};
  const currentUrl = (browser.url || "").toLowerCase();

  const affordances = pageUnderstanding?.importantElements?.length
    ? deriveAffordancesFromImportantElements(pageUnderstanding.importantElements)
    : extractAffordances(browser);

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

  if ((!currentUrl || currentUrl === "about:blank") && candidates.length === 0) {
    candidates.push({
      type: "navigate",
      actions: [{ type: "navigate", params: { url: "https://www.google.com" } }],
      label: "Navigate to search engine",
      reason: "Blank page - navigate to a starting point"
    });
  }

  const queryTerm = extractQueryTerm(goal);
  affordances.typeable.forEach(element => {
    candidates.push({
      type: "type",
      actions: [{ type: "type", params: { element: element.id, text: queryTerm } }],
      elementId: element.id,
      label: `Type "${queryTerm}" in ${element.label || element.role || "input"}`,
      purpose: element.purpose,
      semanticType: element.semanticType,
      reason: "Type target query into available input field"
    });

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
      reason: `Click interaction on ${element.label || element.role || "element"}`
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
