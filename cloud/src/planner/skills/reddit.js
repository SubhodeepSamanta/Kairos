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
    if (objective.includes("search") || objective.includes("find")) {
      const queryMatch = objective.match(/search (?:reddit for|for) (['"]?)(.*?)\1/i) || objective.match(/find (['"]?)(.*?)\1/i);
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
