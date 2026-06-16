export function handleExecutionFailure(goal, currentTask, failedAction, blacklistedSkills) {
  const latestObs = goal.world?.history?.[goal.world.history.length - 1]?.observation;
  const browser = latestObs?.pageState || latestObs || {};
  const pageType = browser.pageType || "";
  
  const skillName = getSkillNameForPageType(pageType);
  if (skillName && !blacklistedSkills.includes(skillName)) {
    console.log(`[STRATEGY] Skill ${skillName} failed on action. Blacklisting skill to fallback to LLM Planner.`);
    blacklistedSkills.push(skillName);
    return { strategy: "replan_llm" };
  }

  console.log(`[STRATEGY] Non-skill execution failed. Requesting standard LLM replan.`);
  return { strategy: "replan_standard" };
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
