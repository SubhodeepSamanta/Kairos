import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { evaluateState } from "../../verification/objectiveVerifier.js";

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
    let matchedBySemantic = false;
    let fallbackToLegacy = false;

    const searchInputs = (browserState.inputs || [])
      .map((input, index) => ({
        input,
        score:
          (input.semanticType === "search_input" ? 100 : 0) +
          (input.purpose === "search_input" ? 70 : 0) +
          (/search|find|query/i.test([input.placeholder, input.ariaLabel, input.name].filter(Boolean).join(" ")) ? 35 : 0) +
          (input.visible === false ? -200 : 20) - index
      }))
      .sort((a, b) => b.score - a.score);
    const searchInput = searchInputs[0]?.score > 0 ? searchInputs[0].input : null;
    matchedBySemantic = searchInput?.semanticType === "search_input";
    fallbackToLegacy = Boolean(searchInput && !matchedBySemantic);

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
          seconds: 1
        }
      });
      actions.push({ type: "read_ui", params: {} });
      console.log(`[SEMANTIC CAPABILITY] name="SearchCapability" matched_by_semantic=${matchedBySemantic} fallback_to_legacy=${fallbackToLegacy}`);
      return { success: true, actions };
    }

    const launcherCandidates = [...(browserState.buttons || []), ...(browserState.links || [])]
      .filter(element => element.visible !== false)
      .map(element => ({
        element,
        score: (element.semanticType === "search_trigger" ? 100 : 0) +
          (element.purpose === "search_launcher" ? 60 : 0) +
          (/search|find/i.test([element.text, element.ariaLabel, element.title].filter(Boolean).join(" ")) ? 30 : 0)
      }))
      .sort((a, b) => b.score - a.score);
    let searchLauncher = launcherCandidates[0]?.score > 0 ? launcherCandidates[0].element : null;
    if (searchLauncher) {
      matchedBySemantic = true;
    } else {
      searchLauncher = (browserState.buttons || []).find(btn => btn.purpose === "search_launcher") ||
                       (browserState.links || []).find(link => link.purpose === "search_launcher");
      if (searchLauncher) fallbackToLegacy = true;
    }

    if (searchLauncher) {
      actions.push({
        type: "click",
        params: {
          element: searchLauncher.id
        }
      });
      actions.push({ type: "read_ui", params: {} });
      console.log(`[SEMANTIC CAPABILITY] name="SearchCapability" matched_by_semantic=${matchedBySemantic} fallback_to_legacy=${fallbackToLegacy}`);
      return { success: true, actions };
    }

    let searchBtn = (browserState.buttons || []).find(btn => btn.semanticType === "search_trigger");
    if (searchBtn) {
      matchedBySemantic = true;
    } else {
      searchBtn = (browserState.buttons || []).find(btn => btn.purpose === "search_button");
      if (searchBtn) fallbackToLegacy = true;
    }

    if (searchBtn) {
      actions.push({
        type: "click",
        params: {
          element: searchBtn.id
        }
      });
      actions.push({ type: "read_ui", params: {} });
      console.log(`[SEMANTIC CAPABILITY] name="SearchCapability" matched_by_semantic=${matchedBySemantic} fallback_to_legacy=${fallbackToLegacy}`);
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
