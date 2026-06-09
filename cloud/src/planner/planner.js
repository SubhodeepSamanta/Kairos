import { askLLM } from "../llm/provider.js";
import { createPlan } from "../shared/schemas/plan.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { validatePlan } from "./validator.js";
import { buildMemoryContext } from "../memory/context.js";

export async function createGoalPlan(goal) {
  const memoryContext = await buildMemoryContext();
  const systemPrompt = buildSystemPrompt(memoryContext);

const response = await askLLM(
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
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (
    start === -1 ||
    end === -1
  ) {
    throw new Error(
      "No JSON found"
    );
  }

  return text.slice(
    start,
    end + 1
  );
}