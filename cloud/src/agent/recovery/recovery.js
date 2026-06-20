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

  return { type: "verification_failed", message: "Target state verification failed", browserState };
}

export function determineRecovery(failure, transition, capability = null, retryCount = 0) {
  console.log(`[RECOVERY] Processing recovery: retryCount=${retryCount}, failureType="${failure.type}"`);

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
      return [{ type: "scroll", params: { direction: "down", amount: 300 } }];

    case "navigation_failed":
    case "verification_failed":
    default:
      if (failure.browserState?.url && failure.browserState.url !== "about:blank") {
        return [{ type: "refresh", params: {} }];
      } else {
        return [{ type: "back", params: {} }];
      }
  }

  return null;
}
