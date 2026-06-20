import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { evaluateState } from "../../verification/objectiveVerifier.js";

export const MediaCapability = {
  name: "MediaCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.90,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "video_playing" || transition.desiredState === "audio_playing";
  },
  execute(transition, browserState) {
    console.log("[MEDIA CAPABILITY INPUT]");
    console.log(JSON.stringify({
      currentUrl: browserState.url,
      currentSite: browserState.site,
      currentPageType: browserState.pageType,
      linksCount: browserState.links?.length || 0
    }, null, 2));

    console.log("[MEDIA CANDIDATES]");
    console.log(JSON.stringify(
      browserState.links?.slice(0, 20),
      null,
      2
    ));

    let matchedBySemantic = false;
    let fallbackToLegacy = false;

    let videoLink = (browserState.links || []).find(link => link.semanticType === "media_element" || link.semanticType === "content_item");
    if (videoLink) {
      matchedBySemantic = true;
    } else {
      videoLink = (browserState.links || []).find(link => link.purpose === "video_link" || (link.href && link.href.includes("/watch")));
      if (videoLink) {
        fallbackToLegacy = true;
      }
    }

    console.log(`[SEMANTIC CAPABILITY] name="MediaCapability" matched_by_semantic=${matchedBySemantic} fallback_to_legacy=${fallbackToLegacy}`);
    
    console.log("[MEDIA SELECTED]");
    console.log(JSON.stringify(videoLink, null, 2));

    if (videoLink) {
      return {
        success: true,
        actions: [{
          type: "click",
          params: {
            element: videoLink.id
          }
        }]
      };
    }
    return { success: false, reason: "No video_link or watch page link found in browser state" };
  },
  verify(transition, observation) {
    if (!observation) return false;
    const resolved = resolveCurrentState(observation);
    const evalRes = evaluateState({ desiredState: "video_playing", platform: transition.platform, parameters: transition.parameters }, resolved, observation);
    return evalRes.matched;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] MediaCapability handling failure: ${failure.type}`);
    return [{ type: "scroll", params: { direction: "down", amount: 200 } }];
  }
};
