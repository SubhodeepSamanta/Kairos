
## File List

- [cloud/src/reasoning/intentParser.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/intentParser.js)
- [cloud/src/reasoning/objectiveBuilder.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/objectiveBuilder.js)
- [cloud/src/capabilities/selection/SelectionCapability.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/selection/SelectionCapability.js)
- [cloud/src/capabilities/router.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/router.js)

## Contents

### cloud/src/reasoning/intentParser.js

```javascript
import { askLLM } from "../llm/provider.js";

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}

export async function parseIntent(goalText) {
  const text = goalText.toLowerCase().trim();

  // Regex-based fast parsing for standard patterns
  // "open youtube", "go to github"
  let match = text.match(/^(?:open|go\s+to|navigate\s+to|visit)\s+([a-z0-9.]+)(?:\.com|\.org)?$/i);
  if (match) {
    return {
      intent: "navigate",
      platform: match[1].trim()
    };
  }

  match = text.match(/^(?:login|sign\s+in|authenticate)(?:\s+to|\s+on)?\s+([a-z0-9.]+)(?:\.com|\.org)?$/i);
  if (match) {
    return {
      intent: "authenticate",
      platform: match[1].trim()
    };
  }

  // "search github for react"
  match = text.match(/^search\s+([a-z0-9.]+)\s+for\s+(.+)$/i);
  if (match) {
    return {
      intent: "search",
      platform: match[1].trim(),
      query: match[2].trim()
    };
  }

  // "search for react on github"
  match = text.match(/^search\s+for\s+(.+?)\s+on\s+([a-z0-9.]+)$/i);
  if (match) {
    return {
      intent: "search",
      platform: match[2].trim(),
      query: match[1].trim()
    };
  }

  // "play lofi on youtube"
  match = text.match(/^play\s+(.+?)\s+on\s+([a-z0-9.]+)$/i);
  if (match && (text.includes("youtube") || text.includes("lofi") || text.includes("video"))) {
    return {
      intent: "play_video",
      platform: match[2].trim(),
      query: match[1].trim()
    };
  }

  // "find latest ai news on bing", "extract latest ai news on twitter"
  match = text.match(/^(?:find|extract|get)\s+(.+?)\s+on\s+([a-z0-9.]+)$/i);
  if (match) {
    return {
      intent: "extract_information",
      topic: match[1].trim(),
      platform: match[2].trim()
    };
  }

  // "find latest ai news", "extract latest ai news"
  match = text.match(/^(?:find|extract|get)\s+(.+)$/i);
  if (match) {
    return {
      intent: "extract_information",
      topic: match[1].trim()
    };
  }

  match = text.match(
    /^(?:play|watch|open|click)\s+(first|second|third|fourth|fifth)\s+(?:video|result|link|item)$/i
  );

  if (match) {
    return {
      intent: "select_result",
      ordinal: match[1],
      targetType: "video",
      useCurrentPage: true,
      originalGoal: goalText
    };
  }

  // Fallback to LLM
  const systemPrompt = `You are an Intent Parser. Parse the user goal into structured JSON.
Supported intents:
- "search" (fields: intent, platform, query)
- "play_video" (fields: intent, platform, query)
- "extract_information" (fields: intent, topic)
- "navigate" (fields: intent, url or platform)
- "authenticate" (fields: intent, platform)
- "generic" (fields: intent)

Return ONLY JSON.

Examples:
"search github for react" -> {"intent": "search", "platform": "github", "query": "react"}
"play lofi on youtube" -> {"intent": "play_video", "platform": "youtube", "query": "lofi"}
"find latest AI news" -> {"intent": "extract_information", "topic": "AI news"}
`;

  try {
    const response = await askLLM(systemPrompt, goalText);
    return JSON.parse(extractJson(response));
  } catch (err) {
    console.error("[intentParser] Fallback failed:", err);
    return {
      intent: "generic",
      originalGoal: goalText
    };
  }
}
```

### cloud/src/reasoning/objectiveBuilder.js

```javascript
export function buildObjectives(intent) {
  const objectives = [];
  const platform =
    intent.useCurrentPage
      ? null
      : (intent.platform || "google");

  // Check for compound goals or sub-actions in intent context
  const originalGoal = (intent.originalGoal || "").toLowerCase();
  
  const hasExtract = originalGoal.includes("extract") || originalGoal.includes("get") || originalGoal.includes("find");
  const hasSearch = originalGoal.includes("search") || originalGoal.includes("find");
  
  if (hasSearch && hasExtract) {
    // Multi-objective compound goal scenario
    objectives.push({
      id: "obj1",
      desiredState: "home",
      platform,
      parameters: {},
      successConditions: [`URL contains ${platform}`],
      priority: 5,
      dependencies: [],
      confidence: 1.0,
      openQuestions: []
    });
    
    const query = intent.query || intent.topic || "query";
    objectives.push({
      id: "obj2",
      desiredState: "results",
      platform,
      parameters: { query },
      successConditions: [`URL contains ${platform}`, `query contains ${query}`],
      priority: 4,
      dependencies: ["obj1"],
      confidence: 1.0,
      openQuestions: []
    });
    
    objectives.push({
      id: "obj3",
      desiredState: "result_selected",
      platform,
      parameters: { ordinal: "first" },
      successConditions: ["URL is detailed result page"],
      priority: 3,
      dependencies: ["obj2"],
      confidence: 1.0,
      openQuestions: []
    });
    
    const extractionQuery = originalGoal.includes("star") ? "extract stars count" : (originalGoal.includes("price") ? "extract price" : "extract details");
    objectives.push({
      id: "obj4",
      desiredState: "information_extracted",
      platform,
      parameters: { query: extractionQuery },
      successConditions: ["data extracted"],
      priority: 2,
      dependencies: ["obj3"],
      confidence: 1.0,
      openQuestions: [`What is the extracted data?`]
    });
    
    return objectives;
  }

  // Standard intent mapping
  switch (intent.intent) {
    case "search": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`],
        priority: 4,
        dependencies: ["obj1"],
        confidence: 1.0,
        openQuestions: []
      });
      break;
    }

    case "play_video": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.query}`],
        priority: 4,
        dependencies: ["obj1"],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj3",
        desiredState: "result_selected",
        platform,
        parameters: {
          ordinal: "first"
        },
        successConditions: [
          "content selected"
        ],
        priority: 3,
        dependencies: ["obj2"],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj4",
        desiredState: "content",
        platform,
        parameters: { query: intent.query },
        successConditions: [`URL contains ${platform}`, `video is playing`],
        priority: 2,
        dependencies: ["obj3"],
        confidence: 1.0,
        openQuestions: []
      });
      break;
    }

    case "extract_information": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "results",
        platform,
        parameters: { query: intent.topic },
        successConditions: [`URL contains ${platform}`, `query contains ${intent.topic}`],
        priority: 4,
        dependencies: ["obj1"],
        confidence: 1.0,
        openQuestions: []
      });
      
      const infoQuestions = [];
      const topicLower = (intent.topic || "").toLowerCase();
      if (topicLower.includes("job") || topicLower.includes("intern") || topicLower.includes("career")) {
        infoQuestions.push(
          "What is the application deadline?",
          "What is the location?",
          "What are the requirements?",
          "What is the application link?"
        );
      } else {
        infoQuestions.push(`What is the extracted data for "${intent.topic}"?`);
      }

      objectives.push({
        id: "obj3",
        desiredState: "information_extracted",
        platform,
        parameters: { topic: intent.topic },
        successConditions: ["data is extracted"],
        priority: 3,
        dependencies: ["obj2"],
        confidence: 1.0,
        openQuestions: infoQuestions
      });
      break;
    }

    case "select_result": {
      objectives.push({
        id: "obj1",
        desiredState: "result_selected",
        platform,
        parameters: {
          ordinal: intent.ordinal
        },
        successConditions: [
          "content selected"
        ],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });

      break;
    }

    case "navigate": {
      const url = intent.url || intent.platform || "google.com";
      const domain = url.toLowerCase().replace(/https?:\/\/(www\.)?/, "").split("/")[0];
      const platformName = domain.replace(/\.com|\.org|\.net/g, "");
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform: platformName,
        parameters: { url },
        successConditions: [`URL contains ${domain}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      break;
    }
    case "authenticate": {
      objectives.push({
        id: "obj1",
        desiredState: "home",
        platform,
        parameters: {},
        successConditions: [`URL contains ${platform}`],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      objectives.push({
        id: "obj2",
        desiredState: "login",
        platform,
        parameters: { email: intent.email, password: intent.password },
        successConditions: ["logged in"],
        priority: 4,
        dependencies: ["obj1"],
        confidence: 1.0,
        openQuestions: []
      });
      break;
    }

    default:
      objectives.push({
        id: "obj1",
        desiredState: "goal_completed",
        platform: "generic",
        parameters: { goal: intent.originalGoal },
        successConditions: ["goal completed"],
        priority: 5,
        dependencies: [],
        confidence: 1.0,
        openQuestions: []
      });
      break;
  }

  return objectives;
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

    console.log(`[SEMANTIC CAPABILITY] name="ResultCapability" matched_by_semantic=${matchedBySemantic} fallback_to_legacy=${fallbackToLegacy}`);

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
    if (failure.type === "element_missing" || failure.type === "verification_failed") {
      return [{ type: "scroll", params: { direction: "down", amount: 300 } }];
    }
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

