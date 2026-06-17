const ORDINALS = {
  "first": 0, "1st": 0, "top": 0,
  "second": 1, "2nd": 1,
  "third": 2, "3rd": 2,
  "fourth": 3, "4th": 3,
  "fifth": 4, "5th": 4,
  "sixth": 5, "6th": 5,
  "seventh": 6, "7th": 6,
  "eighth": 7, "8th": 7,
  "ninth": 8, "9th": 8,
  "tenth": 9, "10th": 9
};

export const resultSkill = {
  name: "ResultSkill",
  canHandle(task, browserState) {
    if (task.intent?.type) {
      return task.intent.type === "result";
    }
    const objective = (task.objective || "").toLowerCase();
    
    // Must contain open/click/select/go to/follow/play etc.
    const actionWords = ["open", "click", "select", "go to", "follow", "play", "watch", "visit"];
    const hasAction = actionWords.some(w => objective.includes(w));
    if (!hasAction) return false;

    // Must specify ordinal
    const hasOrdinal = Object.keys(ORDINALS).some(ord => objective.includes(ord));
    if (!hasOrdinal) return false;

    // Must specify result/link/video/product/post/item
    const resultWords = ["result", "link", "video", "product", "post", "item", "article", "element"];
    return resultWords.some(rw => objective.includes(rw));
  },
  execute(task, browserState) {
    let targetIdx = -1;
    const ordinal = task.intent?.ordinal;

    if (ordinal) {
      targetIdx = ORDINALS[ordinal.toLowerCase()];
    } else {
      const objective = (task.objective || "").toLowerCase();
      for (const [ord, idx] of Object.entries(ORDINALS)) {
        if (objective.includes(ord)) {
          targetIdx = idx;
          break;
        }
      }
    }

    if (targetIdx === -1 || targetIdx === undefined) return null;

    // Find result links
    const candidateLinks = (browserState.links || []).filter(link => {
      return ["result_link", "video_link", "product_link", "post_link", "search_link"].includes(link.purpose);
    });

    if (candidateLinks.length > targetIdx) {
      const targetLink = candidateLinks[targetIdx];
      return [{
        type: "click",
        params: {
          element: targetLink.id
        }
      }];
    }

    // Fallback: all links that look like content results (exclude generic ones if possible)
    const allLinks = (browserState.links || []).filter(link => link.purpose !== "home_link" && link.purpose !== "profile_link");
    if (allLinks.length > targetIdx) {
      const targetLink = allLinks[targetIdx];
      return [{
        type: "click",
        params: {
          element: targetLink.id
        }
      }];
    }

    return null;
  }
};

