export const wikipediaSkill = {
  name: "WikipediaSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("wikipedia_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    // Search article
    if (objective.includes("search") || objective.includes("find") || objective.includes("read about")) {
      const queryMatch = objective.match(/search (?:wikipedia for|for) (['"]?)(.*?)\1/i) || objective.match(/read about (['"]?)(.*?)\1/i) || objective.match(/search (['"]?)(.*?)\1/i);
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

    return null;
  }
};
