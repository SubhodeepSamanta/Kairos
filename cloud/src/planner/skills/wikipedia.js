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
    if (objective.includes("search") || objective.includes("find") || objective.includes("read about") || objective.includes("query") || objective.includes("open")) {
      let query = "";
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        query = quoteMatch[1].trim();
      } else {
        let clean = objective;
        clean = clean.replace(/search\s+(?:wikipedia\s+for|for\s+)?/i, "");
        clean = clean.replace(/read\s+about\s+/i, "");
        clean = clean.replace(/open\s+wikipedia\s+/i, "");
        clean = clean.replace(/\s+on\s+wikipedia/i, "");
        clean = clean.replace(/\s+in\s+wikipedia/i, "");
        query = clean.trim();
      }

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
