import { askLLM } from "../llm/provider.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";

import {
  buildRelevantBrowserContext,
  buildBrowserContext
} from "../agent/context.js";
import { retrieveRelevantMemories } from "../memory/relevant.js";
import { getBrowserState } from "../agent/state.js";
import {
  getWorldSummary
} from "../agent/worldModel.js";
import { routeSkill } from "./skills/router.js";

export async function createReplan({
  goal,
  previousPlan,
  observation,
  observations
}) {

 const currentTask =
  goal.tasks[
    goal.currentTask
  ];

if (!currentTask) {

  throw new Error(
    "No current task"
  );
}

  const browser = getBrowserState() || {};
  goal.blacklistedSkills = goal.blacklistedSkills || [];
  const skillPlan = routeSkill(goal.id, currentTask, browser, goal.blacklistedSkills);
  if (skillPlan) {
    console.log("[REPLANNER] Routed via Skill Router. Bypassing LLM call.");
    goal.metrics = goal.metrics || { skillExecutions: 0, fallbackCount: 0, plannerPromptChars: 0, compressedPromptChars: 0 };
    goal.metrics.skillExecutions++;
    return JSON.stringify(skillPlan.actions);
  }

  console.log(`[SKILL CHECK]
  task objective: "${currentTask.objective}"
  pageType: "${browser.pageType || ""}"
  router result: null (Skill Router bypassed or not matched)`);

console.log(
  "REPLAN TASK:",
  JSON.stringify(
    currentTask,
    null,
    2
  )
);
  const memoryContext =
  await retrieveRelevantMemories(
    currentTask
  );

const browserContext =
  buildRelevantBrowserContext(
    currentTask
  );

  const rawBrowserContext = buildBrowserContext();
  const rawLength = rawBrowserContext.length;
  const compressedLength = browserContext.length;
  const reduction = rawLength > 0 ? ((rawLength - compressedLength) / rawLength * 100).toFixed(1) : 0;
  console.log(`[COMPRESSION] raw context chars: ${rawLength}`);
  console.log(`[COMPRESSION] compressed context chars: ${compressedLength}`);
  console.log(`[COMPRESSION] reduction %: ${reduction}%`);

const worldContext =
  getWorldSummary(
    goal
  );

const systemPrompt =
  buildSystemPrompt(
    currentTask,
    memoryContext,
    browserContext,
    worldContext
  );

  const rawSystemPrompt = buildSystemPrompt(
    currentTask,
    memoryContext,
    rawBrowserContext,
    worldContext
  );

  goal.metrics = goal.metrics || { skillExecutions: 0, fallbackCount: 0, plannerPromptChars: 0, compressedPromptChars: 0 };
  goal.metrics.plannerPromptChars = rawSystemPrompt.length;
  goal.metrics.compressedPromptChars = systemPrompt.length;
  goal.metrics.fallbackCount++;

  console.log(
  "REPLAN BROWSER CONTEXT:\n",
  browserContext
);
  
const summary = {
  lastAction:
    goal.world?.lastAction,

  lastOutcome:
    goal.world?.lastOutcome,

  lastUrl:
    goal.world?.lastUrl,

  lastTitle:
    goal.world?.lastTitle,

  failedActions:
    goal.world?.failedActionHistory?.slice(-5)
};
  
  const userPrompt = `
Original goal:

${goal.objective}

Current task:

${JSON.stringify(
  currentTask,
  null,
  2
)}

World state:

${JSON.stringify(summary, null, 2)}

Previous plan:

${JSON.stringify(
    previousPlan,
    null,
    2
  )}

Recent observations:

${JSON.stringify(
    observations.slice(-3),
    null,
    2
  )}

Latest observation:

${JSON.stringify(
    observation,
    null,
    2
  )}
The previous plan did not achieve the goal.

Analyze why it failed.

Use the observation data to create a better plan.

If a click failed:
- inspect available buttons
- inspect available links
- inspect available inputs

If navigation failed:
- try another route

If the page changed unexpectedly:
- adapt to the current page

Never repeat the exact action that just failed.

If the failed action was:
{
  "type":"click",
  "params":{"text":"banana"}
}

do not return another click on banana.

Instead:
- inspect the page
- choose a different action
- or conclude the goal cannot currently be achieved

Return ONLY valid JSON.
`;
  console.log(
    "SYSTEM CHARS:",
    systemPrompt.length
  );

  console.log(
    "GOAL CHARS:",
    goal.objective.length
  );

  console.log(
    "TOTAL CHARS:",
    systemPrompt.length +
    goal.objective.length
  );
  
  return askLLM(systemPrompt, userPrompt);
}