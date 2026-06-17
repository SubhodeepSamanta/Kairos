export const redditSkill = {
  name: "RedditSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("reddit_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    // Search Reddit / Subreddit
    if (objective.includes("search") || objective.includes("find") || objective.includes("query")) {
      let query = "";
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        query = quoteMatch[1].trim();
      } else {
        let clean = objective;
        clean = clean.replace(/search\s+(?:reddit\s+for|for\s+)?/i, "");
        clean = clean.replace(/find\s+/i, "");
        clean = clean.replace(/\s+on\s+reddit/i, "");
        clean = clean.replace(/\s+in\s+reddit/i, "");
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
