export const linkedinSkill = {
  name: "LinkedInSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("linkedin_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    // Job Search
    if ((objective.includes("search") || objective.includes("query")) && objective.includes("job")) {
      let title = "";
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        title = quoteMatch[1].trim();
      } else {
        const titleMatch = objective.match(/(?:job|jobs) (?:for|as|of)? (['"]?)(.*?)\1/i) || objective.match(/search (['"]?)(.*?)\1/i);
        title = titleMatch ? titleMatch[2] : "";
      }

      if (title) {
        const titleInput = (browserState.inputs || []).find(input => input.purpose === "job_title_input" || input.purpose === "search_input");
        if (titleInput) {
          actions.push({
            type: "type",
            params: {
              element: titleInput.id,
              text: title
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

    // Normal Search (People / Companies)
    if (objective.includes("search") || objective.includes("find") || objective.includes("query")) {
      let query = "";
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        query = quoteMatch[1].trim();
      } else {
        const queryMatch = objective.match(/search (?:linkedin for|for) (['"]?)(.*?)\1/i) || objective.match(/find (['"]?)(.*?)\1/i);
        query = queryMatch ? queryMatch[2] : "";
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

    // Connect with Profile
    if (objective.includes("connect") || objective.includes("follow")) {
      const connectBtn = (browserState.buttons || []).find(btn => btn.purpose === "connect_button" || btn.purpose === "follow_button");
      if (connectBtn) {
        actions.push({
          type: "click",
          params: {
            element: connectBtn.id
          }
        });
        return actions;
      }
    }

    return null;
  }
};
