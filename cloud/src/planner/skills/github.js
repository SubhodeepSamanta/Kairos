export const githubSkill = {
  name: "GitHubSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("github_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    console.log("GITHUB SKILL");
    console.log("PAGE TYPE", browserState.pageType);

    if (objective.includes("search") || objective.includes("query")) {
      let query = "";
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        query = quoteMatch[1].trim();
      } else {
        let clean = objective;
        clean = clean.replace(/search\s+(?:github\s+for|for\s+)?/i, "");
        clean = clean.replace(/query\s+(?:for\s+)?/i, "");
        clean = clean.replace(/\s+on\s+github/i, "");
        clean = clean.replace(/\s+in\s+github/i, "");
        query = clean.trim();
      }
      
      console.log("QUERY", query);
      
      if (query) {
        const searchInput = (browserState.inputs || []).find(input => input.purpose === "search_input");
        console.log("SEARCH INPUT", searchInput);

        if (searchInput) {
          console.log("ACTION: TYPE QUERY");
          console.log("ACTION: PRESS ENTER");
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
        } else {
          // If search input not visible, click the search button/palette trigger on GitHub homepage
          const searchBtn = (browserState.buttons || []).find(btn => btn.purpose === "search_button" || (btn.text && btn.text.toLowerCase().includes("search")));
          console.log("SEARCH BUTTON", searchBtn);

          if (searchBtn) {
            console.log("ACTION: CLICK SEARCH");
            actions.push({
              type: "click",
              params: {
                element: searchBtn.id
              }
            });
            return actions;
          }
        }
      }
    }

    return null;
  }
};
