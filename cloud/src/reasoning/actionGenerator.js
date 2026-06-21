const SITE_MAP = {
  github: "https://github.com",
  youtube: "https://youtube.com",
  google: "https://google.com",
  linkedin: "https://linkedin.com",
  instagram: "https://instagram.com",
  amazon: "https://amazon.com",
  wikipedia: "https://wikipedia.org",
  reddit: "https://reddit.com"
};

function cleanQueryText(query) {
  return query.replace(/\s+on\s+(youtube|github|amazon|google|wikipedia|reddit)$/i, "").trim();
}

function extractSearchQuery(goal) {
  const goalLower = goal.toLowerCase();
  
  // search github for react / search wikipedia for climate change / search for react
  const searchForMatch = goal.match(/search\s+(?:for\s+)?(?:on\s+\w+\s+for\s+)?(.+?)(?:\s+on\s+\w+|\s+in\s+\w+|$)/i);
  if (searchForMatch && searchForMatch[1]) {
    // If the matched string starts with "github for ", e.g. search "github for react" -> capture "github for react" -> strip "github for"
    let clean = searchForMatch[1].trim();
    if (clean.toLowerCase().startsWith("github for ")) clean = clean.slice(11);
    if (clean.toLowerCase().startsWith("youtube for ")) clean = clean.slice(12);
    if (clean.toLowerCase().startsWith("amazon for ")) clean = clean.slice(11);
    if (clean.toLowerCase().startsWith("wikipedia for ")) clean = clean.slice(14);
    return cleanQueryText(clean);
  }

  // play first video of lofi on youtube
  const playVideoMatch = goal.match(/play\s+(?:first\s+|latest\s+)?(?:video\s+of\s+|song\s+of\s+)?(.+?)(?:\s+on\s+\w+|$)/i);
  if (playVideoMatch && playVideoMatch[1]) {
    return cleanQueryText(playVideoMatch[1]);
  }

  return cleanQueryText(goal);
}

export function generateActions(goal, pageUnderstanding, browserState) {
  const candidates = [];
  const goalLower = goal.toLowerCase();
  const browser = browserState || {};
  const elements = pageUnderstanding?.importantElements || [];
  const currentUrl = (browser.url || "").toLowerCase();

  // 1. Navigation Action
  let platformsMentioned = [];
  for (const [key, url] of Object.entries(SITE_MAP)) {
    if (goalLower.includes(key)) {
      platformsMentioned.push({ key, url });
    }
  }

  for (const plat of platformsMentioned) {
    if (!currentUrl.includes(plat.key)) {
      candidates.push({
        type: "navigate",
        actions: [{ type: "navigate", params: { url: plat.url } }],
        label: `Navigate to ${plat.key}`,
        reason: `Goal mentions platform: ${plat.key}`
      });
    }
  }

  const urlMatch = goal.match(/https?:\/\/[^\s]+/i);
  if (urlMatch && urlMatch[0]) {
    const targetUrl = urlMatch[0];
    if (!currentUrl.includes(targetUrl)) {
      candidates.push({
        type: "navigate",
        actions: [{ type: "navigate", params: { url: targetUrl } }],
        label: `Navigate to ${targetUrl}`,
        reason: "Goal mentions explicit URL"
      });
    }
  }

  if ((!currentUrl || currentUrl === "about:blank") && candidates.length === 0) {
    candidates.push({
      type: "navigate",
      actions: [{ type: "navigate", params: { url: "https://www.google.com" } }],
      label: "Navigate to Google",
      reason: "No active page; default to search engine"
    });
  }

  // 2. Elements-Based Actions
  for (const element of elements) {
    if (element.source === "inputs") {
      const queryText = extractSearchQuery(goal);

      // Action 1: Type text
      candidates.push({
        type: "type",
        actions: [{ type: "type", params: { element: element.id, text: queryText } }],
        elementId: element.id,
        label: `Type "${queryText}" in ${element.label || "input"}`,
        purpose: element.purpose,
        semanticType: element.semanticType,
        reason: "Input field available for typing query"
      });

      // Action 2: Type text and press Enter
      candidates.push({
        type: "search",
        actions: [
          { type: "type", params: { element: element.id, text: queryText } },
          { type: "press_key", params: { key: "Enter" } },
          { type: "read_ui", params: {} }
        ],
        elementId: element.id,
        label: `Search for "${queryText}" using ${element.label || "input"}`,
        purpose: element.purpose,
        semanticType: element.semanticType,
        reason: "Submit search/query via Enter keypress"
      });
    }

    if (element.source === "buttons" || element.source === "links") {
      candidates.push({
        type: "click",
        actions: [{ type: "click", params: { element: element.id } }, { type: "read_ui", params: {} }],
        elementId: element.id,
        label: element.label,
        purpose: element.purpose,
        semanticType: element.semanticType,
        href: element.href,
        role: element.role,
        reason: `Click on ${element.label || element.role || "element"}`
      });
    }
  }

  // 3. Global primitive actions
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

  // 4. Data Extraction Action
  const isExtractGoal = /extract|get|find|retrieve|read|deadline|price|stars|info/i.test(goalLower);
  if (isExtractGoal) {
    let cleanQuery = goal;
    const match = goal.match(/(?:extract|get|find|retrieve|read)\s+(.+)/i);
    if (match && match[1]) {
      cleanQuery = match[1].trim();
    }
    candidates.push({
      type: "extract",
      actions: [{ type: "extract_data", params: { query: cleanQuery } }],
      label: `Extract information: ${cleanQuery}`,
      reason: "Goal requests information extraction"
    });
  }

  return candidates;
}
