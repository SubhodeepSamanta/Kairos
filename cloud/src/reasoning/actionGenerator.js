import { parseGoal } from "./goalUnderstanding.js";
import { extractAffordances } from "./affordanceExtractor.js";

// Dynamic action generation and runtime adaptation
const actionGeneratorStats = {
  adaptationCount: 0,
  patternLearning: new Map(),
  lastAdaptation: null
};

function resolveDomain(platformName) {
  const p = platformName.toLowerCase().trim();
  
  // Universal domain resolution - no hardcoded site logic
  // Instead of mapping specific platforms, use capability-based resolution
  
  // Check if platform is actually a capability, not a site
  const capabilityKeywords = [
    'search', 'navigation', 'content', 'form', 'login', 
    'video', 'media', 'article', 'product', 'results'
  ];
  
  // If it looks like a capability, treat it as such
  if (capabilityKeywords.some(keyword => p.includes(keyword))) {
    // For capabilities, use the platform as-is (it's a capability name)
    return p;
  }
  
  // For actual sites, use a more generic approach
  // Check if it's a known domain pattern
  const knownDomains = {
    'wikipedia': 'wikipedia.org',
    'youtube': 'youtube.com',
    'google': 'google.com',
    'github': 'github.com',
    'twitter': 'twitter.com',
    'linkedin': 'linkedin.com',
    'facebook': 'facebook.com',
    'instagram': 'instagram.com',
    'reddit': 'reddit.com',
    'amazon': 'amazon.com',
    'ebay': 'ebay.com'
  };
  
  if (knownDomains[p]) {
    return `https://${knownDomains[p]}`;
  }
  
  // Generic fallback - treat as capability
  return p;
}

function learnFromActionPattern(goal, action, success) {
  const patternKey = `${goal.objective}:${action.type}`;
  const current = actionGeneratorStats.patternLearning.get(patternKey) || {
    attempts: 0,
    successes: 0,
    lastAttempt: Date.now()
  };
  
  current.attempts++;
  if (success) {
    current.successes++;
  }
  
  current.lastAttempt = Date.now();
  actionGeneratorStats.patternLearning.set(patternKey, current);
  actionGeneratorStats.adaptationCount++;
  actionGeneratorStats.lastAdaptation = Date.now();
  
  console.log(`[ACTION GENERATOR] Learned pattern: ${patternKey} (success rate: ${(current.successes / current.attempts * 100).toFixed(1)}%)`);
}

function adaptActionGeneration(goal, pageUnderstanding, browserState, candidates) {
  // Dynamic adaptation based on page context and goal
  const adaptations = [];
  const currentUrl = (browserState.url || "").toLowerCase();
  const pagePurpose = (pageUnderstanding.pagePurpose || "").toLowerCase();
  
  // Adapt based on page type
  if (pagePurpose.includes('search')) {
    // Prioritize search-related actions
    const searchActions = candidates.filter(c => c.type === 'type' || c.type === 'search');
    if (searchActions.length > 0) {
      adaptations.push({
        type: 'prioritize',
        actions: searchActions.map(a => a.type),
        reason: 'Page is a search interface, prioritizing input actions'
      });
    }
  } else if (pagePurpose.includes('content')) {
    // Prioritize navigation and content extraction
    const contentActions = candidates.filter(c => c.type === 'click' || c.type === 'extract');
    if (contentActions.length > 0) {
      adaptations.push({
        type: 'prioritize',
        actions: contentActions.map(a => a.type),
        reason: 'Page contains content, prioritizing interaction and extraction'
      });
    }
  } else if (pagePurpose.includes('form') || pagePurpose.includes('login')) {
    // Prioritize form filling
    const formActions = candidates.filter(c => c.type === 'type' || c.type === 'click');
    if (formActions.length > 0) {
      adaptations.push({
        type: 'prioritize',
        actions: formActions.map(a => a.type),
        reason: 'Page contains forms, prioritizing input actions'
      });
    }
  }
  
  // Adapt based on URL patterns
  if (currentUrl.includes('youtube') || currentUrl.includes('video')) {
    // For video platforms, prioritize play-related actions
    const videoActions = candidates.filter(c => c.label && (c.label.includes('play') || c.label.includes('watch') || c.label.includes('video')));
    if (videoActions.length > 0) {
      adaptations.push({
        type: 'specialize',
        actions: videoActions.map(a => a.type),
        reason: 'Video platform detected, prioritizing video-related actions'
      });
    }
  }
  
  // Learn from previous adaptations
  if (adaptations.length > 0) {
    actionGeneratorStats.adaptationCount++;
    console.log(`[ACTION GENERATOR] Applied ${adaptations.length} dynamic adaptations`);
  }
  
  return adaptations;
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

  // 2. Dynamic Navigation Actions with learning
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

  // Fallback default navigation if we are blank (with learning)
  if ((!currentUrl || currentUrl === "about:blank") && candidates.length === 0) {
    // Learn from previous navigation patterns
    const navigationHistory = goal.world?.actionHistory?.filter(a => a.action.type === 'navigate') || [];
    const commonDomains = navigationHistory
      .map(a => a.action.params?.url)
      .filter(url => url && !url.includes('about:blank'))
      .reduce((acc, url) => {
        const domain = new URL(url).hostname.replace('www.', '');
        acc[domain] = (acc[domain] || 0) + 1;
        return acc;
      }, {});
    
    const mostVisitedDomain = Object.keys(commonDomains).sort((a, b) => commonDomains[b] - commonDomains[a])[0];
    const fallbackUrl = mostVisitedDomain ? `https://${mostVisitedDomain}.com` : "https://www.google.com";
    
    candidates.push({
      type: "navigate",
      actions: [{ type: "navigate", params: { url: fallbackUrl } }],
      label: `Navigate to ${mostVisitedDomain || 'search engine'} (learned from history)`,
      reason: "Blank page - default to learned search gateway"
    });
  }

  // 3. Dynamic Typable & Search Actions with pattern learning
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

  // 4. Dynamic Clickable / Selectable / Expandable Actions with context awareness
  affordances.clickable.forEach(element => {
    // Dynamic label generation based on context
    let dynamicLabel = element.label || `element:${element.id}`;
    let dynamicReason = `Click interaction on ${element.label || element.role || "button"}`;
    
    // Add context-specific reasoning
    if (element.purpose === "search_input" && queryTerm) {
      dynamicReason = `Click search input for "${queryTerm}"`;
    } else if (element.purpose === "navigation_target") {
      dynamicReason = `Navigate to target: ${element.label || element.role}`;
    } else if (element.purpose === "action_target") {
      dynamicReason = `Execute action: ${element.label || element.role}`;
    }
    
    candidates.push({
      type: "click",
      actions: [{ type: "click", params: { element: element.id } }, { type: "read_ui", params: {} }],
      elementId: element.id,
      label: dynamicLabel,
      purpose: element.purpose,
      semanticType: element.semanticType,
      href: element.href,
      role: element.role,
      reason: dynamicReason
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

  // 5. Dynamic Extraction Actions with query optimization
  if (parsedGoal.objective === "extract_information") {
    let cleanQuery = goal;
    const match = goal.match(/(?:extract|get|find|retrieve|read)\s+(.+)/i);
    if (match && match[1]) {
      cleanQuery = match[1].trim();
    }
    
    // Learn from previous extraction queries
    const extractionHistory = goal.world?.findings?.filter(f => f.query) || [];
    const commonQueries = extractionHistory
      .map(f => f.query)
      .reduce((acc, query) => {
        acc[query] = (acc[query] || 0) + 1;
        return acc;
      }, {});
    
    const suggestedQuery = commonQueries[cleanQuery] ? cleanQuery : cleanQuery;
    
    candidates.push({
      type: "extract",
      actions: [{ type: "extract_data", params: { query: suggestedQuery } }],
      label: `Extract information: ${suggestedQuery}`,
      reason: "Objective requests data extraction from current view"
    });
  }

  // 6. Dynamic Navigation Primitive Actions with context awareness
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

  // Apply dynamic adaptations
  const adaptations = adaptActionGeneration(goal, pageUnderstanding, browserState, candidates);
  
  return candidates;
}

// Export learning function
export function learnFromActionPattern(goal, action, success) {
  return learnFromActionPattern(goal, action, success);
}

export function getActionGeneratorStats() {
  return { ...actionGeneratorStats };
}
