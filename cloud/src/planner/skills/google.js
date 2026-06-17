export const googleSkill = {
  name: "GoogleSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("google_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    if (objective.includes("search") || objective.includes("google") || objective.includes("query")) {
      let query = "";
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        query = quoteMatch[1].trim();
      } else {
        let clean = objective;
        clean = clean.replace(/search\s+(?:google\s+for|for\s+)?/i, "");
        clean = clean.replace(/google\s+/i, "");
        clean = clean.replace(/\s+on\s+google/i, "");
        clean = clean.replace(/\s+in\s+google/i, "");
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
