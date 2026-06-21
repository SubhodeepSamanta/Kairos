import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { rankCandidates } from "../../capabilities/selection/candidateRanker.js";
import { understandPage } from "../../world/pageUnderstanding.js";
import { selectActionCandidates } from "../../reasoning/actionSelector.js";

export function diagnoseFailure(transition, browserState, executionResult) {
  if (!browserState) {
    return { type: "timeout", message: "Browser state is empty or timeout occurred", browserState: {} };
  }

  const pageText = (browserState.text || "").toLowerCase();
  
  const closeBtn = (browserState.buttons || []).find(btn => 
    btn.purpose === "close_button" || 
    (btn.text && /close|dismiss|reject|accept/i.test(btn.text)) || 
    (btn.ariaLabel && /close|dismiss/i.test(btn.ariaLabel))
  );
  if (closeBtn) {
    return { 
      type: "blocked_by_modal", 
      message: `Blocked by modal or cookie consent: ${closeBtn.text}`, 
      modalButtonId: closeBtn.id, 
      browserState 
    };
  }

  if (transition.desiredState === "home" || transition.desiredState === "navigate") {
    return { type: "navigation_failed", message: "Navigation failed to reach target state", browserState };
  }

  if (transition.desiredState === "results") {
    const searchInput = (browserState.inputs || []).find(input => input.semanticType === "search_input" || input.purpose === "search_input");
    if (!searchInput) {
      return { type: "element_missing", message: "Search input element not found", browserState };
    }
  }

  if (transition.desiredState === "result_selected" || transition.desiredState === "product_details") {
    const candidateLinks = (browserState.links || []).filter(link => 
      link.semanticType === "content_item" || link.semanticType === "selection_candidate" ||
      ["result_link", "video_link", "product_link", "post_link", "search_link"].includes(link.purpose)
    );
    if (candidateLinks.length === 0) {
      return { type: "element_missing", message: "Result link elements not found", browserState };
    }
  }

  const observedState = resolveCurrentState(browserState);
  return {
    type: "verification_failed",
    message: `Expected ${transition.desiredState}, observed ${observedState.semanticState}`,
    expectedState: transition.desiredState,
    observedState,
    executionResult,
    browserState
  };
}

export function determineRecovery(failure, transition, capability = null, retryCount = 0) {
  console.log(`[RECOVERY] Processing recovery: retryCount=${retryCount}, failureType="${failure.type}"`);

  const browserState = failure.browserState || {};
  const observed = failure.observedState || resolveCurrentState(browserState);
  const pageUnderstanding = understandPage(browserState, observed);

  if (failure.type === "verification_failed" && retryCount === 0) {
    // First ensure recovery decisions use a fresh observation.
    if (!browserState.url || (!browserState.links?.length && !browserState.inputs?.length)) {
      return [{ type: "read_ui", params: {} }];
    }

    const alternatives = selectActionCandidates({
      goal: transition.parameters?.goal || transition.parameters?.query || "",
      inputText: transition.parameters?.query || transition.parameters?.goal || "",
      pageUnderstanding,
      limit: 5,
      minScore: 20
    }).filter(candidate => candidate.type !== "scroll");
    const alternative = alternatives[0];
    if (alternative?.planAction) {
      const actions = [alternative.planAction];
      if (alternative.type === "search") {
        actions.push({ type: "press_key", params: { key: "Enter" } });
      }
      actions.push({ type: "read_ui", params: {} });
      console.log(`[RECOVERY] Trying alternative action "${alternative.type}" from page understanding.`);
      return actions;
    }

    if (transition.desiredState === "result_selected" && observed.currentState === "results") {
      const candidates = (browserState.links || []).filter(link =>
        link.visible !== false && link.semanticType !== "navigation"
      );
      const ranked = rankCandidates(candidates, browserState.links || [], {
        goal: transition.parameters?.goal,
        targetType: transition.parameters?.targetType,
        semanticTarget: transition.semanticTarget
      });
      const alternative = ranked[Math.min(retryCount + 1, ranked.length - 1)];
      if (alternative?.id) {
        console.log(`[RECOVERY] Still on results; trying alternative candidate "${alternative.text || alternative.id}".`);
        return [
          { type: "click", params: { element: alternative.id } },
          { type: "wait", params: { seconds: 1 } },
          { type: "read_ui", params: {} }
        ];
      }
    }

    if (transition.desiredState === "results" && observed.currentState === "home") {
      const searchTrigger = [...(browserState.inputs || []), ...(browserState.buttons || []), ...(browserState.links || [])]
        .find(element => element.semanticType === "search_input" || element.semanticType === "search_trigger" || element.purpose === "search_input");
      if (searchTrigger?.id && searchTrigger.semanticType === "search_trigger") {
        return [{ type: "click", params: { element: searchTrigger.id } }, { type: "read_ui", params: {} }];
      }
      return [{ type: "read_ui", params: {} }];
    }
  }

  if (retryCount === 1) {
    console.log("[RECOVERY ESCALATION] Escalating to: alternative capability");
    return { escalate: "alternative_capability" };
  }
  
  if (retryCount === 2) {
    console.log("[RECOVERY ESCALATION] Escalating to: alternative transition");
    return { escalate: "alternative_transition" };
  }
  
  if (retryCount >= 3) {
    console.log("[RECOVERY ESCALATION] Escalating to: human loop manual action");
    return { 
      escalate: "human_loop", 
      state: "WAITING_FOR_MANUAL_ACTION", 
      reason: `Transition "${transition.id}" failed repeatedly (3+ retries). Requiring manual assistance.`
    };
  }

  if (capability && typeof capability.recover === "function") {
    const capRecovery = capability.recover(failure, transition);
    if (capRecovery && capRecovery.length > 0) {
      console.log(`[RECOVERY] Custom recovery actions provided by capability: ${capability.name}`);
      return capRecovery;
    }
  }

  console.log(`[RECOVERY] Triggering generic simple recovery for failure type: "${failure.type}"`);

  switch (failure.type) {
    case "blocked_by_modal":
      if (failure.modalButtonId) {
        return [{ type: "click", params: { element: failure.modalButtonId } }];
      }
      break;

    case "element_missing":
      return [{ type: "read_ui", params: {} }];

    case "navigation_failed":
      return [{ type: "read_ui", params: {} }];

    case "verification_failed":
    default:
      if (retryCount === 0) return [{ type: "read_ui", params: {} }];
      return [{ type: "scroll", params: { direction: "down", amount: 300 } }];
  }

  return null;
}
