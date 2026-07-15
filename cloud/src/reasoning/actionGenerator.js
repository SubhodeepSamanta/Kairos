import { extractAffordances } from "./affordanceExtractor.js";

export function extractQueryTerm(goalText) {
  const text = goalText.trim();
  const matchFor = text.match(/search\s+(?:for\s+)?(.+?)(?:\s+(?:on|in|and)|$)/i);
  if (matchFor && matchFor[1]) {
    return matchFor[1].trim().replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '');
  }
  const matchOn = text.match(/search\s+(.+?)\s+(?:on|in)\s+[a-z0-9\-]+/i);
  if (matchOn && matchOn[1]) {
    return matchOn[1].trim();
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

export function generateActions(goal, pageUnderstanding, browserState, goalObject) {
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

  const isOnResultsPage = (pageUnderstanding?.resolvedState?.currentState === "results") ||
    (browserState?.url || "").toLowerCase().includes("/results") ||
    (browserState?.url || "").match(/\?(?:q|query)=/);
  const alreadyHasQuery = isOnResultsPage && (() => {
    try {
      const u = new URL(browserState?.url || "");
      return !!(u.searchParams.get("q") || u.searchParams.get("query"));
    } catch (e) { return false; }
  })();

  affordances.typeable.forEach(element => {
    const isSearchInput = element.purpose === "search_input" || element.semanticType === "search_input";
    if (isOnResultsPage && alreadyHasQuery && isSearchInput) {
      return;
    }

    if (isSearchInput) {
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
    } else {
      candidates.push({
        type: "type",
        actions: [{ type: "type", params: { element: element.id, text: queryTerm } }],
        elementId: element.id,
        label: `Type "${queryTerm}" in ${element.label || element.role || "input"}`,
        purpose: element.purpose,
        semanticType: element.semanticType,
        reason: "Type target query into available input field"
      });
    }
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

  if (isOnResultsPage) {
    const resultLinkTypes = ["primary_content", "content_item", "selection_candidate"];
    const resultLinks = (browser.links || []).filter(link =>
      link.purpose === "primary_content" ||
      resultLinkTypes.includes(link.semanticType)
    );
    resultLinks.forEach((link, index) => {
      const label = link.label || link.text || `Result ${index + 1}`;
      candidates.push({
        type: "click",
        actions: [{ type: "click", params: { element: link.id } }, { type: "read_ui", params: {} }],
        elementId: link.id,
        label: `Open result #${index + 1}: ${label}`,
        href: link.href,
        role: link.role,
        semanticType: link.semanticType || "content_item",
        purpose: link.purpose || "primary_content",
        rank: index + 1,
        reason: `Click search result rank ${index + 1}`
      });
    });
    if (resultLinks.length > 0) {
      console.log(`[ACTION GENERATOR] Generated ${resultLinks.length} result-click candidates for results page`);
    }
  }

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

  const tabs = browser.tabs || [];
  if (tabs.length > 1) {
    for (const tab of tabs) {
      if (!tab.active) {
        candidates.push({
          type: "switch_tab",
          actions: [{ type: "switch_tab", params: { index: tab.index } }, { type: "read_ui", params: {} }],
          label: `Switch to tab: ${tab.title || tab.url}`,
          tabIndex: tab.index,
          reason: `Switch to tab containing ${tab.title || "content"}`
        });
      }
    }
    candidates.push({
      type: "close_tab",
      actions: [{ type: "close_tab", params: { index: tabs.find(t => t.active)?.index || 0 } }, { type: "read_ui", params: {} }],
      label: "Close current tab",
      reason: "Close current tab"
    });
  }
  candidates.push({
    type: "new_tab",
    actions: [{ type: "new_tab", params: {} }],
    label: "Open new tab",
    reason: "Open a new blank tab"
  });

  const pagePurpose = pageUnderstanding?.pagePurpose || browserState?.pagePurpose || "";
  if (pagePurpose === "access_control" || pagePurpose === "login") {
    const hasCredentials = (goalObject?.humanInputResponse) || (browserState.inputs || []).some(i => (i.value || "").length > 0);
    if (!hasCredentials) {
      candidates.push({
        type: "login",
        actions: [{ type: "human_input", params: { prompt: "Enter credentials (username:password) for this site" } }],
        label: "Request login credentials",
        purpose: "login_flow",
        reason: "Login form detected — request user credentials"
      });
    }
  }

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
