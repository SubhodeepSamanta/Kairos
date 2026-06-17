export const extractionSkill = {
  name: "ExtractionSkill",
  canHandle(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    return objective.includes("extract") || objective.includes("scrape") || objective.includes("get details") || objective.includes("read");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    return [{
      type: "extract_data",
      params: {
        query: objective
      }
    }];
  }
};
