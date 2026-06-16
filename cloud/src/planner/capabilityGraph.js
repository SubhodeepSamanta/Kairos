import { routeSkill } from "./skills/router.js";

export function resolveExecutor(goalId, task, browserState, blacklistedSkills = []) {
  if (!browserState) return null;

  // If we have blacklisted this skill due to repeated failures, bypass it
  const pageType = browserState.pageType || "";
  const skillName = getSkillNameForPageType(pageType);
  if (skillName && blacklistedSkills.includes(skillName)) {
    console.log(`[CAPABILITY GRAPH] Skill ${skillName} is blacklisted for this task. Bypassing to LLM.`);
    return null;
  }

  const plan = routeSkill(goalId, task, browserState);
  if (plan) {
    console.log(`[CAPABILITY GRAPH] Found capability route: ${skillName}`);
    return plan;
  }

  console.log(`[CAPABILITY GRAPH] No matching skill capability found. Bypassing to LLM.`);
  return null;
}

function getSkillNameForPageType(pageType) {
  if (!pageType) return null;
  if (pageType.startsWith("youtube_")) return "YouTubeSkill";
  if (pageType.startsWith("github_")) return "GitHubSkill";
  if (pageType.startsWith("google_")) return "GoogleSkill";
  if (pageType.startsWith("linkedin_")) return "LinkedInSkill";
  if (pageType.startsWith("instagram_")) return "InstagramSkill";
  if (pageType.startsWith("amazon_")) return "AmazonSkill";
  if (pageType.startsWith("wikipedia_")) return "WikipediaSkill";
  if (pageType.startsWith("reddit_")) return "RedditSkill";
  if (pageType.startsWith("yahoo_")) return "YahooSkill";
  return null;
}
