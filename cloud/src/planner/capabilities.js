import { resolveCurrentState } from "./currentStateResolver.js";
import { evaluateState } from "./objectiveVerifier.js";

const ORDINALS = {
  "first": 0, "1st": 0, "top": 0,
  "second": 1, "2nd": 1,
  "third": 2, "3rd": 2,
  "fourth": 3, "4th": 3,
  "fifth": 4, "5th": 4
};

function initMetrics(cap) {
  cap.executions = 0;
  cap.successes = 0;
  cap.failures = 0;
  cap.successRate = 1.0;
  cap.confidence = 0.9;
}

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

    return { success: false, reason: `Unmapped platform destination: ${target}` };
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

export const TabCapability = {
  name: "TabCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.90,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "new_tab" || transition.desiredState === "switch_tab" || transition.desiredState === "close_tab";
  },
  execute(transition, browserState) {
    if (transition.desiredState === "new_tab") {
      return { success: true, actions: [{ type: "new_tab", params: {} }] };
    }
    if (transition.desiredState === "switch_tab") {
      return { success: true, actions: [{ type: "switch_tab", params: { index: transition.parameters?.index } }] };
    }
    if (transition.desiredState === "close_tab") {
      return { success: true, actions: [{ type: "close_tab", params: { index: transition.parameters?.index } }] };
    }
    return { success: false, reason: `Unsupported tab action: ${transition.desiredState}` };
  },
  verify(transition, observation) {
    return observation && observation.success !== false;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] TabCapability handling failure: ${failure.type}`);
    return null;
  }
};

export const SearchCapability = {
  name: "SearchCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.92,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "results";
  },
  execute(transition, browserState) {
    const query = transition.parameters?.query;
    if (!query) return { success: false, reason: "No search query provided in transition parameters" };

    const actions = [];
    const searchInput = (browserState.inputs || []).find(input => input.purpose === "search_input");
    if (searchInput) {
      actions.push({
        type: "type",
        params: {
          element: searchInput.id,
          text: query
        }
      });
      actions.push({
        type: "press_key",
        params: {
          key: "Enter"
        }
      });
      actions.push({
        type: "wait",
        params: {
          seconds: 3
        }
      });
      return { success: true, actions };
    }

    const searchLauncher = (browserState.buttons || []).find(btn => btn.purpose === "search_launcher") ||
                           (browserState.links || []).find(link => link.purpose === "search_launcher");
    if (searchLauncher) {
      actions.push({
        type: "click",
        params: {
          element: searchLauncher.id
        }
      });
      return { success: true, actions };
    }

    const searchBtn = (browserState.buttons || []).find(btn => btn.purpose === "search_button");
    if (searchBtn) {
      actions.push({
        type: "click",
        params: {
          element: searchBtn.id
        }
      });
      return { success: true, actions };
    }

    return { success: false, reason: "No search input, launcher, or search button found in the browser state" };
  },
  verify(transition, observation) {
    if (!observation) return false;
    const resolved = resolveCurrentState(observation);
    const evalRes = evaluateState({ desiredState: "results", platform: transition.platform, parameters: transition.parameters }, resolved, observation);
    return evalRes.matched;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] SearchCapability handling failure: ${failure.type}`);
    if (failure.type === "element_missing") {
      const browserState = failure.browserState || {};
      const searchLauncher = (browserState.buttons || []).find(btn => btn.purpose === "search_launcher") ||
                             (browserState.links || []).find(link => link.purpose === "search_launcher");
      if (searchLauncher) {
        return [{ type: "click", params: { element: searchLauncher.id } }];
      }
    }
    return null;
  }
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

    const candidateLinks = (browserState.links || []).filter(link => {
      return ["result_link", "video_link", "product_link", "post_link", "search_link"].includes(link.purpose);
    });

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

export const FormCapability = {
  name: "FormCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.85,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "form_submitted" || transition.desiredState === "logged_in";
  },
  execute(transition, browserState) {
    const actions = [];
    const emailInput = (browserState.inputs || []).find(input => input.purpose === "login_email");
    const passwordInput = (browserState.inputs || []).find(input => input.purpose === "login_password");
    const submitBtn = (browserState.buttons || []).find(btn => btn.purpose === "login_button" || btn.purpose === "submit_button");

    if (emailInput && !emailInput.value) {
      actions.push({
        type: "type",
        params: {
          element: emailInput.id,
          text: transition.parameters?.email || "user@example.com"
        }
      });
    }
    if (passwordInput && !passwordInput.value) {
      actions.push({
        type: "type",
        params: {
          element: passwordInput.id,
          text: transition.parameters?.password || "password"
        }
      });
    }
    if (submitBtn) {
      actions.push({
        type: "click",
        params: {
          element: submitBtn.id
        }
      });
    }
    if (actions.length > 0) return { success: true, actions };
    return { success: false, reason: "No relevant login fields or submit buttons available to execute" };
  },
  verify(transition, observation) {
    if (!observation) return false;
    const resolved = resolveCurrentState(observation);
    const pageText = (observation.text || "").toLowerCase();
    const isLoginWall = pageText.includes("sign in") || pageText.includes("login") || pageText.includes("password");
    return !isLoginWall && observation.success !== false;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] FormCapability handling failure: ${failure.type}`);
    return null;
  }
};

export const ExtractionCapability = {
  name: "ExtractionCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.94,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "information_extracted";
  },
  execute(transition, browserState) {
    return {
      success: true,
      actions: [{
        type: "extract_data",
        params: {
          query: transition.parameters?.query || "extract information"
        }
      }]
    };
  },
  verify(transition, observation) {
    return observation && observation.success === true;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] ExtractionCapability handling failure: ${failure.type}`);
    return null;
  }
};
