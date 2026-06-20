import { resolveCurrentState } from "../world/currentStateResolver.js";
import { evaluateState } from "../verification/objectiveVerifier.js";

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
