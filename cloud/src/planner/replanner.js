import { askLLM } from "../llm/provider.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { buildMemoryContext } from "../memory/context.js";

export async function createReplan({
  goal,
  previousPlan,
  observation,
  observations
}) {

  const memoryContext =await buildMemoryContext();
  const systemPrompt = buildSystemPrompt(memoryContext);

  const userPrompt = `
Original goal:

${goal.objective}

Previous plan:

${JSON.stringify(
  previousPlan,
  null,
  2
)}

All observations:

${JSON.stringify(
  observations,
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

  return askLLM(systemPrompt,userPrompt);
}