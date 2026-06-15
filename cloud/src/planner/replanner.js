import { askLLM } from "../llm/provider.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";

import {
  buildRelevantBrowserContext
} from "../agent/context.js";
import { retrieveRelevantMemories } from "../memory/relevant.js";
import { getAgentState } from "../agent/state.js";

export async function createReplan({
  goal,
  previousPlan,
  observation,
  observations
}) {

  const intent =
  getAgentState().intent;
 const currentTask =
  goal.tasks[
    goal.currentTask
  ];

if (!currentTask) {

  throw new Error(
    "No current task"
  );
}
console.log(
  "REPLAN INTENT:",
  JSON.stringify(
    intent,
    null,
    2
  )
);
  const memoryContext =
  await retrieveRelevantMemories(
    intent
  );

const browserContext =
  buildRelevantBrowserContext(
    intent
  );

const systemPrompt =
  buildSystemPrompt(
    intent,
    memoryContext,
    browserContext
  );
  console.log(
  "REPLAN BROWSER CONTEXT:\n",
  browserContext
);
  
  const userPrompt = `
Original goal:

${goal.objective}

Current task:

${JSON.stringify(
  currentTask,
  null,
  2
)}

Intent:

${JSON.stringify(intent, null, 2)}

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