import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { rankCandidates, scoreCandidate } from "./candidateRanker.js";
import { isDebug } from "../../utils/logger.js";

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
    if (isDebug()) {
      console.log("[CAPABILITY INPUT TRANSITION]");
      console.log(JSON.stringify(transition, null, 2));

      console.log("[SELECTION INPUT]");
      console.log(JSON.stringify({
        currentUrl: browserState.url,
        currentSite: browserState.site,
        currentPageType: browserState.pageType,
        linksCount: browserState.links?.length || 0
      }, null, 2));

      console.log("[SELECTION CANDIDATES]");
      console.log(JSON.stringify(
        browserState.links?.slice(0, 20),
        null,
        2
      ));
    }

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

    let candidateLinks = (browserState.links || []).filter(link => {
      if (link.semanticType) {
        return link.semanticType !== "navigation";
      }
      // Backwards compatibility fallback to legacy purpose
      const legacyPurposes = ["result_link", "video_link", "product_link", "post_link", "search_link", "content_item", "selection_candidate"];
      return legacyPurposes.includes(link.purpose);
    });

    if (isDebug()) {
      console.log(`[SEMANTIC CAPABILITY] name="ResultCapability" candidates_count=${candidateLinks.length}`);
    }

    const rankingContext = {
      goal: transition.parameters?.goal || transition.parameters?.query || "",
      targetType: transition.parameters?.targetType,
      semanticTarget: transition.semanticTarget || transition.parameters?.semanticTarget,
      historicalSuccess: transition.parameters?.historicalSuccess || {}
    };
    candidateLinks = rankCandidates(candidateLinks, browserState.links || [], rankingContext);

    if (isDebug()) {
      candidateLinks.forEach(c => {
        const pos = (browserState.links || []).indexOf(c);
        console.log(
          "[RESULT PICK]",
          {
            id: c.id,
            text: c.text,
            href: c.href,
            score: scoreCandidate(c, pos, rankingContext)
          }
        );
      });
    } else {
      console.log("[TOP CANDIDATES]");
      candidateLinks.slice(0, 5).forEach((c, idx) => {
        const pos = (browserState.links || []).indexOf(c);
        const score = scoreCandidate(c, pos, rankingContext);
        console.log(`${idx + 1}. ${(c.text || c.id || "Link")} score=${score}`);
      });
    }

    let resolvedIdx = targetIdx;
    if (ordKey === "last") {
      resolvedIdx = candidateLinks.length - 1;
    }

    if (candidateLinks.length > resolvedIdx && resolvedIdx >= 0) {
      const targetLink = candidateLinks[resolvedIdx];
      if (isDebug()) {
        console.log(
          "[RESULT PICK WINNER]",
          targetLink
        );
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
      } else {
        console.log(`[RESULT PICK WINNER]\n${targetLink.text || targetLink.id || "Link"}`);
      }
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
    return resolved.currentState === "content";
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] ResultCapability handling failure: ${failure.type}`);
    return null;
  }
};

export const SelectionCapability = ResultCapability;
