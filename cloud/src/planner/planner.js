import { askLLM } from "../llm/provider.js";
import { createPlan } from "../shared/schemas/plan.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { validatePlan } from "./validator.js";
import { buildMemoryContext } from "../memory/context.js";
import {
  getAgentState
} from "../agent/state.js";



import {
  buildBrowserContext
} from "../agent/context.js";

export async function createGoalPlan(goal) {

  const memoryContext =
    await buildMemoryContext();

  const browserContext =
    buildBrowserContext();

  const systemPrompt =
    buildSystemPrompt(
      memoryContext,
      browserContext
    );

  console.log(
    "AGENT STATE:",
    JSON.stringify(
      getAgentState(),
      null,
      2
    )
  );
console.log(
  "BROWSER CONTEXT:\n",
  browserContext
);
  const response =
    await askLLM(
      systemPrompt,
      goal.objective
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