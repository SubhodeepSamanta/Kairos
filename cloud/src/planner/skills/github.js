export const githubSkill = {
  name: "GitHubSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("github_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    if (objective.includes("search")) {
      const queryMatch = objective.match(/search (?:github for|for) (['"]?)(.*?)\1/i) || objective.match(/search (['"]?)(.*?)\1/i);
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
