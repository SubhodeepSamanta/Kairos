
## File List

- [cloud/src/capabilities/selection/SelectionCapability.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/selection/SelectionCapability.js)
- [cloud/src/reasoning/transitionGenerator.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/transitionGenerator.js)
- [cloud/src/capabilities/router.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/router.js)

## Contents

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
    if (failure.type === "element_missing" || failure.type === "verification_failed") {
      return [{ type: "scroll", params: { direction: "down", amount: 300 } }];
    }
    return null;
  }
};

export const SelectionCapability = ResultCapability;
```

### cloud/src/reasoning/transitionGenerator.js

```javascript
import { createTask } from "../shared/schemas/task.js";
import { normalizeObjective, normalizeResolvedState, transitionId } from "../world/stateNormalization.js";

export function generateTransitions(currentState, desiredObjective, failedTransitions = {}) {
  console.log("[TRANSITION GENERATOR INPUT RECEIVED currentState]");
  console.log(JSON.stringify(currentState, null, 2));
  console.log("[TRANSITION GENERATOR INPUT RECEIVED desiredObjective]");
  console.log(JSON.stringify(desiredObjective, null, 2));

  const normalizedCurrentState = normalizeResolvedState(currentState);
  const normalizedDesiredObjective = normalizeObjective(desiredObjective);

  console.log("[TRANSITION INPUT]");
  console.log(JSON.stringify({
    currentPlatform: normalizedCurrentState.platform,
    currentState: normalizedCurrentState.currentState,
    desiredPlatform: normalizedDesiredObjective.platform,
    desiredState: normalizedDesiredObjective.desiredState,
    parameters: normalizedDesiredObjective.parameters
  }, null, 2));

  const candidates = [];
  const cleanCurPlatform = (normalizedCurrentState.platform || "").toLowerCase();
  const cleanCurState = (normalizedCurrentState.currentState || "").toLowerCase();
  const cleanObjPlatform = (normalizedDesiredObjective.platform || "").toLowerCase();
  const desiredState = normalizedDesiredObjective.desiredState;
  const legacyDesiredState = (normalizedDesiredObjective.legacyDesiredState || desiredState || "").toLowerCase();
  const legacyDesiredSegment = legacyDesiredState.startsWith(`${cleanObjPlatform}_`) ? legacyDesiredState : `${cleanObjPlatform}_${legacyDesiredState}`;

  // Candidate 1: Transition to target platform's home first if platforms don't match
  if (cleanCurPlatform !== cleanObjPlatform && 
      desiredState !== "home" && 
      desiredState !== "goal_completed") {
    
    const transId = transitionId(cleanCurState, "home");
    const legacyTransId = `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_home`;
    const failureCount = failedTransitions[transId] || failedTransitions[legacyTransId] || 0;
    
    // Calculate score & confidence
    let score = 0.8 - (failureCount * 0.25);
    let confidence = parseFloat(Math.max(0.1, 0.9 - (failureCount * 0.3)).toFixed(2));
    
    candidates.push({
      id: transId,
      legacyId: legacyTransId,
      desiredState: "home",
      state: "home",
      platform: normalizedDesiredObjective.platform,
      parameters: {},
      score,
      confidence
    });
  }

  // Candidate 2: Direct transition to the desired final state
  const directTransId = transitionId(cleanCurState, desiredState);
  const legacyDirectTransId = `${cleanCurPlatform}_${cleanCurState}_to_${legacyDesiredSegment}`;
  const directFailureCount = failedTransitions[directTransId] || failedTransitions[legacyDirectTransId] || 0;
  
  // Final state has higher direct priority if we are already on the right platform
  let directScore = (cleanCurPlatform === cleanObjPlatform ? 1.0 : 0.7) - (directFailureCount * 0.25);
  let directConfidence = parseFloat(Math.max(0.1, 0.95 - (directFailureCount * 0.3)).toFixed(2));

  candidates.push({
    id: directTransId,
    legacyId: legacyDirectTransId,
    desiredState,
    state: desiredState,
    legacyDesiredState: desiredObjective.desiredState,
    platform: normalizedDesiredObjective.platform,
    parameters: normalizedDesiredObjective.parameters || {},
    score: directScore,
    confidence: directConfidence
  });

  // Candidate 3: Navigation Fallback to target platform home if stuck
  const fallbackTransId = transitionId(cleanCurState, "home");
  const legacyFallbackTransId = `${cleanCurPlatform}_${cleanCurState}_to_${cleanObjPlatform}_home`;
  const fallbackFailureCount = failedTransitions[fallbackTransId] || failedTransitions[legacyFallbackTransId] || 0;
  if (desiredState !== "home" && cleanCurState !== "home") {
    candidates.push({
      id: fallbackTransId,
      legacyId: legacyFallbackTransId,
      desiredState: "home",
      state: "home",
      platform: normalizedDesiredObjective.platform,
      parameters: {},
      score: 0.4 - (fallbackFailureCount * 0.2),
      confidence: parseFloat(Math.max(0.1, 0.7 - (fallbackFailureCount * 0.2)).toFixed(2))
    });
  }

  // Sort candidate transitions by score in descending order
  candidates.sort((a, b) => b.score - a.score);

  console.log(`[STATE MACHINE] Generated and ranked transitions:`, JSON.stringify(candidates.map(c => ({ id: c.id, score: c.score.toFixed(2), conf: c.confidence })), null, 2));

  console.log("[TRANSITION OUTPUT]");
  console.log(JSON.stringify(candidates, null, 2));

  return candidates;
}

export function generateTasksForTransitions(transitions) {
  return transitions.map(trans => {
    const platform = trans.platform || "generic";
    const platformUrl = platform.includes(".") ? platform : (platform === "generic" ? "https://google.com" : `https://${platform}.com`);

    switch (trans.desiredState) {
      case "home":
        return createTask({
          objective: `reach_${platform}_home`,
          intent: { type: "navigate", action: "navigate", target: platformUrl },
          successCriteria: [`URL contains ${platform}`]
        });

      case "results":
        return createTask({
          objective: `reach_${platform}_results`,
          intent: { type: "search", action: "search", query: trans.parameters.query },
          successCriteria: [`URL contains ${platform}`]
        });

      case "content":
        return createTask({
          objective: `reach_${platform}_content`,
          intent: { type: "media", action: "play", query: trans.parameters.query },
          successCriteria: [`URL contains ${platform}`]
        });

      case "login":
        return createTask({
          objective: `reach_${platform}_login`,
          intent: { type: "authenticate", action: "login", email: trans.parameters.email, password: trans.parameters.password },
          successCriteria: ["logged in"]
        });

      case "information_extracted":
        return createTask({
          objective: "reach_information_extracted",
          intent: { type: "extract", action: "extract", topic: trans.parameters.topic },
          successCriteria: ["data is extracted"]
        });

      default:
        return createTask({
          objective: "reach_goal_completed",
          intent: { type: "generic" },
          successCriteria: ["goal completed"]
        });
    }
  });
}
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

