import { routeSkill } from "./skills/router.js";

export function resolveExecutor(goalId, task, browserState, blacklistedSkills = []) {
  if (!browserState) return null;

  const pageType = browserState.pageType || "";
  const skillName = getSkillNameForPageType(pageType);
  
  const registeredSkills = [
    "YouTubeSkill (youtube_*)",
    "GitHubSkill (github_*)",
    "GoogleSkill (google_*)",
    "LinkedInSkill (linkedin_*)",
    "InstagramSkill (instagram_*)",
    "AmazonSkill (amazon_*)",
    "WikipediaSkill (wikipedia_*)",
    "RedditSkill (reddit_*)",
    "YahooSkill (yahoo_*)"
  ];
  console.log(`[CAPABILITY GRAPH] pageType="${pageType}", blacklisted=${JSON.stringify(blacklistedSkills)}`);
  console.log(`[CAPABILITY GRAPH] Registered skills: ${JSON.stringify(registeredSkills)}`);
  console.log(`[CAPABILITY GRAPH] Skills available for "${pageType}": ${JSON.stringify(skillName ? [skillName] : [])}`);

  if (skillName && blacklistedSkills.includes(skillName)) {
    console.log(`[CAPABILITY GRAPH] Skill ${skillName} is blacklisted for this task. Bypassing to LLM.`);
    return null;
  }

  const plan = routeSkill(goalId, task, browserState, blacklistedSkills);
  if (plan) {
    console.log(`[CAPABILITY GRAPH] Found capability route: executor="${skillName}"`);
    return plan;
  }

  console.log(`[CAPABILITY GRAPH] No matching skill capability found for pageType="${pageType}". Bypassing to LLM.`);
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
