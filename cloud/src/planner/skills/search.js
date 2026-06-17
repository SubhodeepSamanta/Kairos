import { resultSkill } from "./result.js";

export const searchSkill = {
  name: "SearchSkill",
  canHandle(task, browserState) {
    if (resultSkill.canHandle(task, browserState)) {
      return false;
    }
    if (task.intent?.type) {
      return task.intent.type === "search";
    }
    const objective = (task.objective || "").toLowerCase();
    return objective.includes("search") || objective.includes("query") || objective.includes("find");
  },
  execute(task, browserState) {
    const actions = [];
    let query = "";

    if (task.intent?.query) {
      query = task.intent.query;
    } else {
      const objective = (task.objective || "").toLowerCase();
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        query = quoteMatch[1].trim();
      } else {
        let clean = objective;
        clean = clean.replace(/search\s+(?:for\s+)?/i, "");
        clean = clean.replace(/query\s+(?:for\s+)?/i, "");
        clean = clean.replace(/find\s+/i, "");
        clean = clean.replace(/\s+on\s+[a-z0-9.]+/i, "");
        clean = clean.replace(/\s+in\s+[a-z0-9.]+/i, "");
        query = clean.trim();
      }
    }

    if (!query) return null;

    // Pattern A: search_input exists
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

    // Pattern B: search_launcher exists
    const searchLauncher = (browserState.buttons || []).find(btn => btn.purpose === "search_launcher") ||
                           (browserState.links || []).find(link => link.purpose === "search_launcher");
    if (searchLauncher) {
      actions.push({
        type: "click",
        params: {
          element: searchLauncher.id
        }
      });
      return actions;
    }

    // Fallback: search_button
    const searchBtn = (browserState.buttons || []).find(btn => btn.purpose === "search_button");
    if (searchBtn) {
      actions.push({
        type: "click",
        params: {
          element: searchBtn.id
        }
      });
      return actions;
    }

    return null;
  }
};

