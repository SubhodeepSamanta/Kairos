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
  if (!browserState) return null;
  
  for (const skill of SKILLS) {
    if (blacklistedSkills.includes(skill.name)) {
      console.log(`[SKILL ROUTER] Skill ${skill.name} is blacklisted. Bypassing.`);
      continue;
    }
    if (skill.canHandle(task, browserState)) {
      const actions = skill.execute(task, browserState);
      if (actions && actions.length > 0) {
        console.log(`[SKILL ROUTER] Executing skill: ${skill.name}`);
        return createPlan(goalId, actions);
      }
    }
  }
  return null;
}
