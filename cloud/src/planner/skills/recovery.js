export const recoverySkill = {
  name: "RecoverySkill",
  canHandle(task, browserState) {
    if (!browserState || !browserState.url || browserState.url === "about:blank") {
      return false;
    }
    return true; // Catch-all fallback
  },
  execute(task, browserState) {
    const actions = [];
    
    // 1. Close modals if close button is present
    const closeBtn = (browserState.buttons || []).find(btn => btn.purpose === "close_button" || (btn.text && btn.text.toLowerCase().includes("close")) || (btn.ariaLabel && btn.ariaLabel.toLowerCase().includes("close")));
    if (closeBtn) {
      actions.push({
        type: "click",
        params: {
          element: closeBtn.id
        }
      });
      return actions;
    }

    // 2. Open search launcher if we are stuck on home page and need to search
    const objective = (task.objective || "").toLowerCase();
    if (objective.includes("search") || objective.includes("find")) {
      const searchLauncher = (browserState.buttons || []).find(btn => btn.purpose === "search_launcher") ||
                             (browserState.links || []).find(link => link.purpose === "search_launcher") ||
                             (browserState.inputs || []).find(input => input.purpose === "search_launcher");
      if (searchLauncher && browserState.pageType && (browserState.pageType.includes("home") || browserState.pageType.includes("page"))) {
        actions.push({
          type: "click",
          params: {
            element: searchLauncher.id
          }
        });
        return actions;
      }
    }

    // 3. Fallback: try going back or refreshing to recover from blank or broken state
    if (browserState.url && browserState.url !== "about:blank") {
      actions.push({
        type: "refresh",
        params: {}
      });
    } else {
      actions.push({
        type: "back",
        params: {}
      });
    }

    return actions;
  }
};
