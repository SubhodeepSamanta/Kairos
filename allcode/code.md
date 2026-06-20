
## File List

- [cloud/src/world/currentStateResolver.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js)
- [cloud/src/world/stateNormalization.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/stateNormalization.js)
- [cloud/src/capabilities/selection/SelectionCapability.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/selection/SelectionCapability.js)
- [cloud/src/capabilities/router.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/router.js)
- [cloud/src/agent/loop/transitionLoop.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/agent/loop/transitionLoop.js)

## Contents

### cloud/src/world/currentStateResolver.js

```javascript
import { normalizeResolvedState } from "./stateNormalization.js";

export function resolveCurrentState(observation, previousResolvedState = null) {
  const pageState = observation?.pageState || observation || {};
  console.log("[STATE RESOLVER INPUT]");
  console.log(JSON.stringify({
    title: pageState?.title,
    url: pageState?.url,
    pageType: pageState?.pageType,
    site: pageState?.site,
    activeTab: pageState?.activeTab,
    tabs: pageState?.tabs?.map(t => ({
      title: t.title,
      url: t.url,
      active: t.active
    }))
  }, null, 2));

  const browser = observation?.pageState || observation || {};
  const url = (observation?.url || browser?.url || "").toLowerCase();
  const title = (observation?.title || browser?.title || "").toLowerCase();
  
  if ((!url || url === "about:blank") && previousResolvedState) {
    console.log("[STATE RESOLVER OUTPUT]");
    console.log(JSON.stringify(previousResolvedState, null, 2));
    return previousResolvedState;
  }
  
  let platform = "generic";
  let currentState = "content";
  let query = "";
  let isHomeUrl = false;

  const ENVIRONMENT_MAP = {
    "google": "search_site",
    "github": "search_site",
    "youtube": "media_site",
    "amazon": "commerce_site",
    "reddit": "discussion_site",
    "wikipedia": "knowledge_site",
    "linkedin": "professional_site",
    "twitter": "social_site",
    "x": "social_site",
    "instagram": "social_site"
  };

  if (url.includes("github.com")) {
    platform = "github";
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "youtube";
  } else if (url.includes("amazon.com")) {
    platform = "amazon";
  } else if (url.includes("google.com")) {
    platform = "google";
  } else if (url.includes("linkedin.com")) {
    platform = "linkedin";
  } else if (url && url !== "about:blank") {
    try {
      const host = new URL(url).hostname;
      platform = host.replace("www.", "").split(".")[0] || "generic";
    } catch (e) {
      platform = "generic";
    }
  }

  const pageType = (browser.pageType || "").toLowerCase();
  if (platform === "generic" && pageType) {
    const platforms = ["github", "youtube", "amazon", "google", "linkedin", "instagram", "reddit", "wikipedia"];
    for (const p of platforms) {
      if (pageType.includes(p) || title.includes(p)) {
        platform = p;
        break;
      }
    }
  }

  let environment = observation?.environment || browser?.environment || ENVIRONMENT_MAP[platform] || "generic";

  if (!url || url === "about:blank") {
    currentState = "blank";
    platform = "generic";
    environment = "generic";
  } else {
    let urlObj;
    try {
      urlObj = new URL(url);
      if (urlObj.searchParams.has("q")) {
        query = urlObj.searchParams.get("q");
      } else if (urlObj.searchParams.has("query")) {
        query = urlObj.searchParams.get("query");
      } else if (urlObj.searchParams.has("search_query")) {
        query = urlObj.searchParams.get("search_query");
      } else if (urlObj.searchParams.has("k")) {
        query = urlObj.searchParams.get("k");
      }
    } catch (e) {
    }

    const hasResultLinks = (browser.links || []).some(link =>
      [
        "primary_content",
        "content_item",
        "selection_candidate"
      ].includes(link.semanticType)
    );
    const hasSearchInput = (browser.inputs || []).some(input => input.purpose === "search_input");

    const pathname = urlObj ? urlObj.pathname.split("/").filter(Boolean) : [];
    const isHomePath = pathname.length === 0 || (pathname.length === 1 && ["feed", "home", "index.html", "index.php"].includes(pathname[0]));
    isHomeUrl = isHomePath || pageType.includes("home");

    if (pageType === "logged_in" || pageType.includes("logged_in")) {
      currentState = "login";
    } else if (isHomeUrl && !query && !url.includes("/search") && !url.includes("/results") && !pageType.includes("results")) {
      currentState = "home";
    } else if (query || url.includes("/search") || url.includes("/results") || pageType.includes("results") || (hasResultLinks && hasSearchInput)) {
      currentState = "results";
    } else if ((platform === "youtube" && (url.includes("/watch") || url.includes("v="))) || pageType.includes("video_playing") || pageType.includes("watch")) {
      currentState = "content";
    } else {
      currentState = "content";
    }
  }

    const capabilities = browser.capabilities || [];
    let semanticState = "content_viewing";
    if (pageType === "logged_in" || pageType.includes("logged_in")) {
      semanticState = "authenticated";
    } else if (isHomeUrl && !query) {
      semanticState = "home_active";
    } else if (capabilities.includes("results_available") || query) {
      semanticState = "results_viewing";
    } else if (capabilities.includes("media_available")) {
      semanticState = "media_active";
    } else if (capabilities.includes("authentication_available")) {
      semanticState = "auth_active";
    } else if (capabilities.includes("form_available")) {
      semanticState = "form_active";
    }

    console.log(`[SEMANTIC STATE] legacyState="${currentState}" semanticState="${semanticState}"`);

    const legacyState = pageType.includes("logged_in")
      ? "logged_in"
      : (pageType.includes("video_playing") ? "video_playing" : currentState);

    const resolvedState = {
      platform,
      environment,
      currentState,
      state: currentState,
      legacyState,
      semanticState,
      parameters: {
        query,
        url
      }
    };

    const normalizedResolvedState = normalizeResolvedState(resolvedState);

    console.log("[STATE RESOLVER OUTPUT]");
    console.log(JSON.stringify(normalizedResolvedState, null, 2));

    return normalizedResolvedState;
}
```

### cloud/src/world/stateNormalization.js

```javascript
const STATE_ALIASES = {
  youtube_home: "home",
  youtube_results: "results",
  youtube_video: "content",
  youtube_video_playing: "content",
  video: "content",
  video_playing: "content",
  audio_playing: "content",
  logged_in: "login",
  authenticated: "login",
  auth: "login",
  form_submitted: "login",
  preferences: "settings",
  account_settings: "settings"
};

const GENERIC_STATES = new Set([
  "home",
  "results",
  "content",
  "login",
  "settings",
  "blank",
  "navigate",
  "goal_completed",
  "information_extracted",
  "result_selected",
  "product_details",
  "new_tab",
  "switch_tab",
  "close_tab"
]);

export function normalizeStateName(state, platform = "") {
  const raw = (state || "").toLowerCase().trim();
  if (!raw) return "content";

  if (STATE_ALIASES[raw]) return STATE_ALIASES[raw];
  if (GENERIC_STATES.has(raw)) return raw;

  const cleanPlatform = (platform || "").toLowerCase().trim();
  if (cleanPlatform && raw.startsWith(`${cleanPlatform}_`)) {
    return normalizeStateName(raw.slice(cleanPlatform.length + 1), cleanPlatform);
  }

  if (raw.includes("home")) return "home";
  if (raw.includes("result") || raw.includes("search")) return "results";
  if (raw.includes("login") || raw.includes("logged_in") || raw.includes("auth")) return "login";
  if (raw.includes("setting") || raw.includes("preference")) return "settings";
  if (raw.includes("video") || raw.includes("watch") || raw.includes("audio")) return "content";

  return raw;
}

export function normalizeResolvedState(resolvedState = {}) {
  const platform = resolvedState.platform || "generic";
  const legacyState = resolvedState.legacyState || resolvedState.currentState || resolvedState.state;
  const currentState = normalizeStateName(resolvedState.currentState || resolvedState.state, platform);

  return {
    ...resolvedState,
    platform,
    currentState,
    state: currentState,
    legacyState
  };
}

export function normalizeObjective(objective = {}) {
  const platform = objective.platform || "generic";
  const desiredState = normalizeStateName(objective.desiredState || objective.state, platform);

  return {
    ...objective,
    platform,
    desiredState,
    state: desiredState,
    legacyDesiredState: objective.legacyDesiredState || objective.desiredState || objective.state
  };
}

export function normalizeTransition(transition = {}) {
  const normalizedObjective = normalizeObjective({
    platform: transition.platform,
    desiredState: transition.desiredState,
    state: transition.state
  });

  return {
    ...transition,
    platform: normalizedObjective.platform,
    desiredState: normalizedObjective.desiredState,
    state: normalizedObjective.desiredState,
    legacyDesiredState: transition.legacyDesiredState || transition.desiredState || transition.state
  };
}

export function toLegacyCapabilityTransition(transition = {}) {
  const normalized = normalizeTransition(transition);
  let desiredState = normalized.desiredState;

  if (desiredState === "content") {
    desiredState = normalized.platform === "youtube" ? "video_playing" : (normalized.legacyDesiredState || "content");
  } else if (desiredState === "login") {
    desiredState = "logged_in";
  }

  return {
    ...normalized,
    desiredState,
    state: normalized.desiredState
  };
}

export function transitionId(fromState, toState) {
  return `${normalizeStateName(fromState)}_to_${normalizeStateName(toState)}`;
}
```

### cloud/src/capabilities/selection/SelectionCapability.js

```javascript
import { resolveCurrentState } from "../../world/currentStateResolver.js";

const ORDINALS = {
  "first": 0, "1st": 0, "top": 0,
  "second": 1, "2nd": 1,
  "third": 2, "3rd": 2,
  "fourth": 3, "4th": 3,
  "fifth": 4, "5th": 4,
  "last": "last",
  "next": "next",
  "previous": "previous"
};

function scoreCandidate(link) {
  let score = 0;

  if (link.semanticType === "primary_content")
    score += 100;

  if (link.semanticType === "content_item")
    score += 50;

  if (link.purpose === "video_link")
    score += 50;

  if (link.href?.includes("/watch") || link.href?.includes("/shorts") || link.href?.includes("/live"))
    score += 100;

  if (link.text?.length > 5)
    score += 10;

  return score;
}

export const ResultCapability = {
  name: "ResultCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.88,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "result_selected" || transition.desiredState === "product_details";
  },
  execute(transition, browserState) {
    console.log("[CAPABILITY INPUT TRANSITION]");
    console.log(JSON.stringify(transition, null, 2));

    console.log("[SELECTION INPUT]");
    console.log(JSON.stringify({
      currentUrl: browserState.url,
      currentSite: browserState.site,
      currentPageType: browserState.pageType,
      linksCount: browserState.links?.length || 0
    }, null, 2));

    let targetIdx = 0;
    const ordinal = transition.parameters?.ordinal || "first";
    const ordKey = ordinal.toLowerCase();
    if (ordinal && ORDINALS[ordKey] !== undefined) {
      const val = ORDINALS[ordKey];
      if (typeof val === "number") {
        targetIdx = val;
      }
    }

    console.log("[SELECTION CANDIDATES]");
    console.log(JSON.stringify(
      browserState.links?.slice(0, 20),
      null,
      2
    ));

    let matchedBySemantic = false;
    let fallbackToLegacy = false;

    let candidateLinks = (browserState.links || []).filter(link => {
      return link.semanticType === "primary_content";
    });

    if (candidateLinks.length > 0) {
      matchedBySemantic = true;
    } else {
      candidateLinks = (browserState.links || []).filter(link => {
        return link.semanticType === "content_item" || link.semanticType === "selection_candidate";
      });
      if (candidateLinks.length > 0) {
        matchedBySemantic = true;
      } else {
        candidateLinks = (browserState.links || []).filter(link => {
          return ["result_link", "video_link", "product_link", "post_link", "search_link"].includes(link.purpose);
        });
        if (candidateLinks.length > 0) {
          fallbackToLegacy = true;
        }
      }
    }

    console.log(`[SEMANTIC CAPABILITY] name="ResultCapability" matched_by_semantic=${matchedBySemantic} fallback_to_legacy=${fallbackToLegacy}`);

    const currentPlatform =
      browserState.site?.toLowerCase();

    if (currentPlatform === "youtube") {
      candidateLinks =
        candidateLinks.filter(
          l =>
            l.href?.includes("/watch") ||
            l.href?.includes("/live")
        );
    }

    candidateLinks.sort((a, b) => {
      return scoreCandidate(b) - scoreCandidate(a);
    });

    let resolvedIdx = targetIdx;
    if (ordKey === "last") {
      resolvedIdx = candidateLinks.length - 1;
    }

    if (candidateLinks.length > resolvedIdx && resolvedIdx >= 0) {
      const targetLink = candidateLinks[resolvedIdx];
      console.log("[RESULT PICK]");
      console.log(JSON.stringify({
        ordinal,
        resolvedIdx,
        chosenId: targetLink.id,
        chosenText: targetLink.text,
        chosenHref: targetLink.href
      }, null, 2));
      console.log("[SELECTION SELECTED]");
      console.log(JSON.stringify(targetLink, null, 2));
      return {
        success: true,
        actions: [{
          type: "click",
          params: {
            element: targetLink.id
          }
        }]
      };
    }

    const allLinks = (browserState.links || []).filter(link => link.purpose !== "home_link" && link.purpose !== "profile_link");
    let resolvedIdxAll = targetIdx;
    if (ordKey === "last") {
      resolvedIdxAll = allLinks.length - 1;
    }

    if (allLinks.length > resolvedIdxAll && resolvedIdxAll >= 0) {
      const targetLink = allLinks[resolvedIdxAll];
      console.log("[RESULT PICK]");
      console.log(JSON.stringify({
        ordinal,
        resolvedIdx: resolvedIdxAll,
        chosenId: targetLink.id,
        chosenText: targetLink.text,
        chosenHref: targetLink.href
      }, null, 2));
      console.log("[SELECTION SELECTED]");
      console.log(JSON.stringify(targetLink, null, 2));
      return {
        success: true,
        actions: [{
          type: "click",
          params: {
            element: targetLink.id
          }
        }]
      };
    }

    return { success: false, reason: `No links available at index position ${targetIdx}` };
  },
  verify(transition, observation) {
    if (!observation) return false;
    const resolved = resolveCurrentState(observation);
    return resolved.currentState !== "results" && observation.success !== false;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] ResultCapability handling failure: ${failure.type}`);
    return null;
  }
};

export const SelectionCapability = ResultCapability;
```

### cloud/src/capabilities/router.js

```javascript
import {
  NavigationCapability,
  TabCapability,
  SearchCapability,
  ResultCapability,
  MediaCapability,
  FormCapability,
  ExtractionCapability
} from "./index.js";
import { normalizeTransition, toLegacyCapabilityTransition } from "../world/stateNormalization.js";

const CAPABILITIES = [
  TabCapability,
  ResultCapability,
  SearchCapability,
  MediaCapability,
  FormCapability,
  ExtractionCapability,
  NavigationCapability
];

export function routeCapability(transition, blacklistedCapabilities = []) {
  console.log("[CAPABILITY ROUTER INPUT]");
  console.log(JSON.stringify({ transition, blacklistedCapabilities }, null, 2));

  const normalizedTransition = normalizeTransition(transition);
  const capabilityTransition = toLegacyCapabilityTransition(normalizedTransition);

  console.log(`[ROUTER] Routing transition: "${normalizedTransition.id}" (desiredState: "${normalizedTransition.desiredState}")`);
  
  let bestCap = null;
  let bestScore = -1;

  for (const cap of CAPABILITIES) {
    if (blacklistedCapabilities.includes(cap.name)) {
      console.log(`[ROUTER] Capability ${cap.name} is blacklisted. Bypassing.`);
      continue;
    }
    if (cap.canHandle(normalizedTransition) || cap.canHandle(capabilityTransition)) {
      const score = cap.successRate * cap.confidence;
      console.log(`[ROUTER] Capability ${cap.name} matched. Score: ${score.toFixed(2)} (successRate=${cap.successRate.toFixed(2)}, confidence=${cap.confidence.toFixed(2)})`);
      if (score > bestScore) {
        bestCap = cap;
        bestScore = score;
      }
    }
  }
  
  if (bestCap) {
    console.log(`[ROUTER] Routed to highest confidence capability: ${bestCap.name} (score: ${bestScore.toFixed(2)})`);
    console.log("[CAPABILITY ROUTER OUTPUT]");
    console.log(JSON.stringify({ name: bestCap.name, successRate: bestCap.successRate, confidence: bestCap.confidence }, null, 2));

    return {
      ...bestCap,
      execute(browserTransition, browserState) {
        return bestCap.execute(toLegacyCapabilityTransition(browserTransition), browserState);
      },
      verify(browserTransition, observation) {
        return bestCap.verify(toLegacyCapabilityTransition(browserTransition), observation);
      },
      recover(failure, browserTransition) {
        return bestCap.recover(failure, toLegacyCapabilityTransition(browserTransition));
      }
    };
  }
  
  console.log("[ROUTER] No matching capability found.");
  console.log("[CAPABILITY ROUTER OUTPUT] null");
  return null;
}
```

### cloud/src/agent/loop/transitionLoop.js

```javascript
import { generateTransitions } from "../../reasoning/transitionGenerator.js";
import { generateExecutionSummary } from "../../world/executionContext.js";

export function processTransitions({
  goal,
  resolvedCurState,
  currentObj,
  failedTransitions,
  latestObs,
  context,
  totalActions,
  MAX_GOAL_ACTIONS
}) {
  const transitions = generateTransitions(resolvedCurState, currentObj, failedTransitions);
  if (transitions.length === 0) {
    console.log("[AGENT] No transitions generated. Target might be reached.");
    const summary = generateExecutionSummary(context, goal.tracker);
    console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    return {
      shouldExit: true,
      exitValue: {
        success: true,
        confidence: 0.9,
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  const activeTransition = transitions[0];

  console.log(`
=========================================
CURRENT STATE: platform="${resolvedCurState.platform}" state="${resolvedCurState.currentState}" (query="${resolvedCurState.parameters?.query || ""}")
DESIRED STATE: platform="${currentObj.platform}" state="${currentObj.desiredState}" (query="${currentObj.parameters?.query || ""}")
TRANSITIONS: ${transitions.map(t => `${t.id} (${t.score.toFixed(2)})`).join(", ")}
ACTIVE TRANSITION: ${activeTransition.id} (confidence: ${activeTransition.confidence})
=========================================
`);
  console.log("[TRANSITION]", activeTransition);

  if (totalActions > MAX_GOAL_ACTIONS) {
    console.log(`[BUDGET] Goal exceeded max actions of ${MAX_GOAL_ACTIONS}`);
    const summary = generateExecutionSummary(context, goal.tracker);
    console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    return {
      shouldExit: true,
      exitValue: {
        success: false,
        reason: "goal_action_budget_exceeded",
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  return { shouldExit: false, activeTransition };
}
```

