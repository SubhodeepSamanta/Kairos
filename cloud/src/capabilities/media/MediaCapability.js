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
    const videoLink = (browserState.links || []).find(link => link.purpose === "video_link" || (link.href && link.href.includes("/watch")));
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
