export const youtubeSkill = {
  name: "YouTubeSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("youtube_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    if (objective.includes("search") || objective.includes("play") || objective.includes("watch") || objective.includes("query")) {
      // Search YouTube
      if (objective.includes("search") || objective.includes("query") || (objective.includes("play") && browserState.pageType === "youtube_home")) {
        let query = "";
        const quoteMatch = objective.match(/['"](.*?)['"]/);
        if (quoteMatch && quoteMatch[1].trim()) {
          query = quoteMatch[1].trim();
        } else {
          const queryMatch = objective.match(/search (?:youtube for|for) (['"]?)(.*?)\1/i) || objective.match(/(?:play|watch) (['"]?)(.*?)\1/i);
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

      // Play video from results
      if (browserState.pageType === "youtube_results" && (objective.includes("play") || objective.includes("watch") || objective.includes("open"))) {
        const videoLink = (browserState.links || []).find(link => link.href && link.href.includes("/watch"));
        if (videoLink) {
          actions.push({
            type: "click",
            params: {
              element: videoLink.id
            }
          });
          return actions;
        }
      }
    }

    return null;
  }
};
