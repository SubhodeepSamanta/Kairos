import { resolveCurrentState } from "../../world/currentStateResolver.js";

const ORDINALS = {
  "first": 0, "1st": 0, "top": 0,
  "second": 1, "2nd": 1,
  "third": 2, "3rd": 2,
  "fourth": 3, "4th": 3,
  "fifth": 4, "5th": 4
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
    let targetIdx = 0;
    const ordinal = transition.parameters?.ordinal || "first";
    if (ordinal && ORDINALS[ordinal.toLowerCase()] !== undefined) {
      targetIdx = ORDINALS[ordinal.toLowerCase()];
    }

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

    if (candidateLinks.length > targetIdx) {
      const targetLink = candidateLinks[targetIdx];
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
    if (allLinks.length > targetIdx) {
      const targetLink = allLinks[targetIdx];
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
