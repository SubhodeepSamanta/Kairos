export function handleExecutionFailure(goal, currentTask, failedAction, blacklistedSkills) {
  let pageType = "";
  if (goal.world?.history) {
    for (let i = goal.world.history.length - 1; i >= 0; i--) {
      const obs = goal.world.history[i]?.observation;
      const pt = obs?.pageState?.pageType || obs?.pageType;
      if (pt) {
        pageType = pt;
        break;
      }
    }
  }
  
  console.log(`[STRATEGY] Failure detected. pageType="${pageType}", failedAction=${JSON.stringify(failedAction)}`);

  const skillName = getSkillNameForPageType(pageType);
  if (skillName && !blacklistedSkills.includes(skillName)) {
    console.log(`[STRATEGY] Blacklisting skill: "${skillName}". Reason: execution failure on pageType "${pageType}".`);
    blacklistedSkills.push(skillName);
    return { strategy: "replan_llm" };
  } else if (skillName) {
    console.log(`[STRATEGY] Skill "${skillName}" was already blacklisted.`);
  }

  console.log(`[STRATEGY] Non-skill execution failed. Requesting standard LLM replan.`);
  return { strategy: "replan_standard" };
}

function getSkillNameForPageType(pageType) {
  if (!pageType) return null;
  if (pageType === "video_page") return "MediaCapability";
  if (pageType === "result_page") return "SearchCapability";
  if (pageType === "product_page") return "ResultCapability";
  if (pageType === "form_page") return "FormCapability";
  if (pageType === "profile_page") return "FormCapability";
  return null;
}
