export const navigationSkill = {
  name: "NavigationSkill",
  canHandle(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    if (objective.includes("back") || objective.includes("refresh") || objective.includes("tab") || objective.includes("new tab") || objective.includes("open tab")) {
      return true;
    }
    if (objective.match(/https?:\/\/[^\s]+/)) {
      return true;
    }
    const sites = ["github", "youtube", "google", "linkedin", "instagram", "amazon", "wikipedia", "reddit", "yahoo"];
    if (sites.some(site => objective.includes(site))) {
      return true;
    }
    return false;
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();

    if (objective.includes("back")) {
      return [{ type: "back", params: {} }];
    }
    if (objective.includes("refresh")) {
      return [{ type: "refresh", params: {} }];
    }
    if (objective.includes("new tab") || objective.includes("open tab")) {
      return [{ type: "new_tab", params: {} }];
    }
    
    const urlMatch = objective.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return [{
        type: "navigate",
        params: {
          url: urlMatch[0]
        }
      }];
    }

    const SITE_MAP = {
      github: "https://github.com",
      youtube: "https://youtube.com",
      google: "https://google.com",
      linkedin: "https://linkedin.com",
      instagram: "https://instagram.com",
      amazon: "https://amazon.com",
      wikipedia: "https://wikipedia.org",
      reddit: "https://reddit.com",
      yahoo: "https://yahoo.com"
    };

    for (const [key, val] of Object.entries(SITE_MAP)) {
      if (objective.includes(key)) {
        return [{
          type: "navigate",
          params: {
            url: val
          }
        }];
      }
    }

    return null;
  }
};
