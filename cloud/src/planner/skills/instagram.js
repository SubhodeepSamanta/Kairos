export const instagramSkill = {
  name: "InstagramSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("instagram_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    // Search profile or hashtag
    if (objective.includes("search") || objective.includes("find")) {
      const queryMatch = objective.match(/search (?:instagram for|for) (['"]?)(.*?)\1/i) || objective.match(/find (['"]?)(.*?)\1/i);
      const query = queryMatch ? queryMatch[2] : "";

      if (query) {
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
          return actions;
        }
      }
    }

    // Follow profile
    if (objective.includes("follow")) {
      const followBtn = (browserState.buttons || []).find(btn => btn.purpose === "follow_button");
      if (followBtn) {
        actions.push({
          type: "click",
          params: {
            element: followBtn.id
          }
        });
        return actions;
      }
    }

    return null;
  }
};
