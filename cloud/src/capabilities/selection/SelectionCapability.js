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
