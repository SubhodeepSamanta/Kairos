import { createPlan } from "../../shared/schemas/plan.js";
import { youtubeSkill } from "./youtube.js";
import { githubSkill } from "./github.js";
import { googleSkill } from "./google.js";
import { linkedinSkill } from "./linkedin.js";
import { instagramSkill } from "./instagram.js";
import { amazonSkill } from "./amazon.js";
import { wikipediaSkill } from "./wikipedia.js";
import { redditSkill } from "./reddit.js";
import { yahooSkill } from "./yahoo.js";

const SKILLS = [
  youtubeSkill,
  githubSkill,
  googleSkill,
  linkedinSkill,
  instagramSkill,
  amazonSkill,
  wikipediaSkill,
  redditSkill,
  yahooSkill
];

export function routeSkill(goalId, task, browserState, blacklistedSkills = []) {
  if (!browserState) {
    console.log("[ROUTER] No browserState provided to routeSkill.");
    return null;
  }
  
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
        console.log(`[ROUTER] matched skill: ${skill.name}`);
        return createPlan(goalId, actions);
      }
    }
  }
  console.log("[ROUTER] No skill matched the current task and state.");
  return null;
}
