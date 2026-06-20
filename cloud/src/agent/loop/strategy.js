export function handleExecutionFailure(goal, currentTask, failedAction, blacklistedSkills) {
  let pageType = "";
  let capabilities = [];
  if (goal.world?.history) {
    for (let i = goal.world.history.length - 1; i >= 0; i--) {
      const obs = goal.world.history[i]?.observation;
      const pt = obs?.pageState?.pageType || obs?.pageType;
      const caps = obs?.pageState?.capabilities || obs?.capabilities;
      if (pt) {
        pageType = pt;
      }
      if (caps && caps.length > 0) {
        capabilities = caps;
      }
      if (pt || (caps && caps.length > 0)) {
        break;
      }
    }
  }
  
  console.log(`[STRATEGY] Failure detected. pageType="${pageType}", capabilities=${JSON.stringify(capabilities)}, failedAction=${JSON.stringify(failedAction)}`);

  const skillName = getSkillNameForPageType(pageType, capabilities);
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

function getSkillNameForPageType(pageType, capabilities = []) {
  if (capabilities && capabilities.length > 0) {
    if (capabilities.includes("media_available")) return "MediaCapability";
    if (capabilities.includes("results_available")) return "SearchCapability";
    if (capabilities.includes("selection_available")) return "ResultCapability";
    if (capabilities.includes("authentication_available") || capabilities.includes("form_available")) return "FormCapability";
  }
  if (!pageType) return null;
  if (pageType === "video_page") return "MediaCapability";
  if (pageType === "result_page") return "SearchCapability";
  if (pageType === "product_page") return "ResultCapability";
  if (pageType === "form_page") return "FormCapability";
  if (pageType === "profile_page") return "FormCapability";
  return null;
}
