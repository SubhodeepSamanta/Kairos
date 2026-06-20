import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { evaluateState } from "../../verification/objectiveVerifier.js";

export const NavigationCapability = {
  name: "NavigationCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.95,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "home" || transition.desiredState === "navigate";
  },
  execute(transition, browserState) {
    const target = transition.parameters?.url || transition.platform;
    if (!target) return { success: false, reason: "No target platform or URL specified" };
    
    if (target === "back") {
      return { success: true, actions: [{ type: "back", params: {} }] };
    }
    if (target === "refresh") {
      return { success: true, actions: [{ type: "refresh", params: {} }] };
    }

    if (target.match(/https?:\/\/[^\s]+/)) {
      return { success: true, actions: [{ type: "navigate", params: { url: target } }] };
    }

    const SITE_MAP = {
      github: "https://github.com",
      youtube: "https://youtube.com",
      google: "https://google.com",
      linkedin: "https://linkedin.com",
      instagram: "https://instagram.com",
      amazon: "https://amazon.com",
      wikipedia: "https://wikipedia.org",
      reddit: "https://reddit.com",
      yahoo: "https://yahoo.com"
    };

    const mapped = SITE_MAP[target.toLowerCase()];
    if (mapped) {
      return { success: true, actions: [{ type: "navigate", params: { url: mapped } }] };
    }

    const fallbackUrl = target.includes(".") ? (target.match(/https?:\/\//) ? target : `https://${target}`) : `https://${target.toLowerCase().replace(/\s+/g, "")}.com`;
    return { success: true, actions: [{ type: "navigate", params: { url: fallbackUrl } }] };
  },
  verify(transition, observation) {
    if (!observation) return false;
    const resolved = resolveCurrentState(observation);
    const evalRes = evaluateState({ desiredState: transition.desiredState, platform: transition.platform, parameters: transition.parameters }, resolved, observation);
    return evalRes.matched;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] NavigationCapability handling failure: ${failure.type}`);
    return [{ type: "refresh", params: {} }];
  }
};
