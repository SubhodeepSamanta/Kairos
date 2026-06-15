
## File List

- [cloud/src/planner/planner.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/planner.js)
- [cloud/src/planner/replanner.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/replanner.js)
- [cloud/src/planner/prompt/systemPrompt.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/prompt/systemPrompt.js)

## Contents

### cloud/src/planner/planner.js

```javascript
import { askLLM } from "../llm/provider.js";
import { createPlan } from "../shared/schemas/plan.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { validatePlan } from "./validator.js";
import {
  retrieveRelevantMemories
} from "../memory/relevant.js";
import {
  getWorldSummary
} from "../agent/worldModel.js";



import {
  buildBrowserContext,
  buildRelevantBrowserContext
} from "../agent/context.js";

export async function createGoalPlan(goal) {

  const currentTask =
    goal.tasks[
      goal.currentTask
    ];

  const memoryContext =
    await retrieveRelevantMemories(
      currentTask
    );
  console.log(
    "MEMORY CONTEXT:\n",
    memoryContext
  );
  const browserContext =
    buildRelevantBrowserContext(
      currentTask
    );
if (
  !browserContext.trim()
) {

  console.log(
    "EMPTY BROWSER CONTEXT"
  );
}
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

  console.log(
    "CURRENT TASK:",
    JSON.stringify(
      currentTask,
      null,
      2
    )
  );
  console.log(
    "BROWSER CONTEXT:\n",
    browserContext
  );
  console.log(
    "MEMORY CHARS:",
    memoryContext.length
  );

  console.log(
    "BROWSER CHARS:",
    browserContext.length
  );

  console.log(
    "SYSTEM PROMPT CHARS:",
    systemPrompt.length
  );
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

  console.log(
    "TASK:",
    JSON.stringify(
      currentTask,
      null,
      2
    )
  );
if (!currentTask) {

  console.log(
    "NO CURRENT TASK"
  );

  return createPlan(
    goal.id,
    []
  );
}

  const latestObs = goal.world?.history?.[goal.world.history.length - 1]?.observation;
  const browser = latestObs?.pageState || latestObs || {};
  
  const userPrompt = JSON.stringify({
    task: {
      id: currentTask.id,
      objective: currentTask.objective,
      successCriteria: currentTask.successCriteria
    },
    lastAction: goal.world?.lastAction || null,
    lastOutcome: goal.world?.lastOutcome || null,
    browserState: {
      url: browser.url || goal.world?.lastUrl || "",
      title: browser.title || goal.world?.lastTitle || "",
      inputs: browser.inputs || [],
      buttons: browser.buttons || [],
      links: browser.links || [],
      forms: browser.forms || []
    }
  }, null, 2);

const response =
  await askLLM(
    systemPrompt,
    userPrompt
  );

  console.log(
    "PLANNER RESPONSE:",
    response
  );

  console.log(
    "RAW LLM RESPONSE:",
    response
  );

  return parsePlanResponse(
    goal.id,
    response
  );
}

export function parsePlanResponse(goalId, response) {
  let parsed;

  try {
    parsed = JSON.parse(
      extractJson(response)
    );
    console.log(
      "PARSED:",
      JSON.stringify(
        parsed,
        null,
        2
      )
    );
    if (
      Array.isArray(parsed)
    ) {

      parsed = {
        actions: parsed
      };
    }
    if (
      parsed.type &&
      parsed.params
    ) {

      parsed = {
        actions: [parsed]
      };
    }
  }

  catch {
    return createPlan(goalId, []);
  }

  if (
    !parsed || !Array.isArray(parsed.actions)
  ) {
    return createPlan(goalId, []);
  }

  const validated = validatePlan(parsed);

  console.log(
    "VALIDATED ACTIONS:",
    JSON.stringify(
      validated.actions,
      null,
      2
    )
  );

  return createPlan(
    goalId,
    validated.actions
  );
}

function extractJson(text) {

  const arrayStart =
    text.indexOf("[");

  const objectStart =
    text.indexOf("{");

  if (
    arrayStart !== -1 &&
    (
      objectStart === -1 ||
      arrayStart < objectStart
    )
  ) {

    const end =
      text.lastIndexOf("]");

    return text.slice(
      arrayStart,
      end + 1
    );
  }

  const end =
    text.lastIndexOf("}");

  return text.slice(
    objectStart,
    end + 1
  );
}
```

### cloud/src/planner/replanner.js

```javascript
import { askLLM } from "../llm/provider.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";

import {
  buildRelevantBrowserContext
} from "../agent/context.js";
import { retrieveRelevantMemories } from "../memory/relevant.js";
import { getAgentState } from "../agent/state.js";
import {
  getWorldSummary
} from "../agent/worldModel.js";

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

World state:

${JSON.stringify(goal.world, null, 2)}

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
```

### cloud/src/planner/prompt/systemPrompt.js (Error Reading File)

Could not read file: ENOENT: no such file or directory, open 'C:\Users\USER\Desktop\Kairos\cloud\src\planner\prompt\systemPrompt.js'

