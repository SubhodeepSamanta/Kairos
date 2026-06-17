import { createPlan } from "../../shared/schemas/plan.js";
import { searchSkill } from "./search.js";
import { videoSkill } from "./video.js";
import { formFillSkill } from "./formFill.js";
import { extractionSkill } from "./extraction.js";
import { navigationSkill } from "./navigation.js";
import { recoverySkill } from "./recovery.js";
import { youtubeSkill } from "./youtube.js";
import { githubSkill } from "./github.js";
import { googleSkill } from "./google.js";
import { linkedinSkill } from "./linkedin.js";
import { instagramSkill } from "./instagram.js";
import { amazonSkill } from "./amazon.js";
import { wikipediaSkill } from "./wikipedia.js";
import { redditSkill } from "./reddit.js";
import { yahooSkill } from "./yahoo.js";
import { resultSkill } from "./result.js";

const SKILLS = [
  resultSkill,
  searchSkill,
  videoSkill,
  formFillSkill,
  extractionSkill,
  navigationSkill,
  youtubeSkill,
  githubSkill,
  googleSkill,
  linkedinSkill,
  instagramSkill,
  amazonSkill,
  wikipediaSkill,
  redditSkill,
  yahooSkill,
  recoverySkill
];

export function routeSkill(goalId, task, browserState, blacklistedSkills = []) {
  if (!browserState) {
    console.log("[ROUTER] No browserState provided to routeSkill.");
    return null;
  }

  // Print Semantic Diagnostics
  const allInputs = browserState.inputs || [];
  const allButtons = browserState.buttons || [];
  const allLinks = browserState.links || [];

  const countPurpose = (purpose) => {
    return allInputs.filter(x => x.purpose === purpose).length +
           allButtons.filter(x => x.purpose === purpose).length +
           allLinks.filter(x => x.purpose === purpose).length;
  };

  console.log(`[SEMANTIC]
search_input: ${countPurpose("search_input")}
search_launcher: ${countPurpose("search_launcher")}
search_button: ${countPurpose("search_button")}
video_link: ${countPurpose("video_link")}
product_link: ${countPurpose("product_link")}
result_link: ${countPurpose("result_link")}
login_button: ${countPurpose("login_button")}
submit_button: ${countPurpose("submit_button")}
menu_button: ${countPurpose("menu_button")}
close_button: ${countPurpose("close_button")}
next_button: ${countPurpose("next_button")}
back_button: ${countPurpose("back_button")}
download_button: ${countPurpose("download_button")}
filter_button: ${countPurpose("filter_button")}
sort_button: ${countPurpose("sort_button")}
login_email: ${countPurpose("login_email")}
login_password: ${countPurpose("login_password")}`);
  
  console.log(`[ROUTER] routeSkill invocation trace:
  - task.objective: "${task.objective}"
  - task.intent: ${JSON.stringify(task.intent || null)}
  - pageType: "${browserState.pageType || ""}"
  - url: "${browserState.url || ""}"
  - blacklistedSkills: ${JSON.stringify(blacklistedSkills)}`);
  
  for (const skill of SKILLS) {
    console.log(`[ROUTER] Evaluating skill: ${skill.name}`);
    if (blacklistedSkills.includes(skill.name)) {
      console.log(`[ROUTER] Skill ${skill.name} is blacklisted. Bypassing.`);
      continue;
    }
    const canHandle = skill.canHandle(task, browserState);
    console.log(`[ROUTER] Skill ${skill.name} canHandle returned: ${canHandle}`);
    if (canHandle) {
      const actions = skill.execute(task, browserState);
      console.log(`[ROUTER] Skill ${skill.name} execute returned actions: ${actions ? JSON.stringify(actions) : "null"}`);
      if (actions && actions.length > 0) {
        console.log(`[SKILL]
matched: ${skill.name}
reason: page contains matched capability`);
        return createPlan(goalId, actions);
      }
    }
  }
  console.log("[ROUTER] No skill matched the current task and state.");
  return null;
}
