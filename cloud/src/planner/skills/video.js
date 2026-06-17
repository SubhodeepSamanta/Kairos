export const videoSkill = {
  name: "VideoSkill",
  canHandle(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    return objective.includes("play") || objective.includes("watch") || objective.includes("video");
  },
  execute(task, browserState) {
    const actions = [];
    const videoLink = (browserState.links || []).find(link => link.purpose === "video_link" || (link.href && link.href.includes("/watch")));
    if (videoLink) {
      actions.push({
        type: "click",
        params: {
          element: videoLink.id
        }
      });
      return actions;
    }
    return null;
  }
};
