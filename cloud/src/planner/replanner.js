import { askLLM } from "../llm/provider.js";
import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import { buildMemoryContext } from "../memory/context.js";

export async function createReplan({goal,previousPlan,observation}) {

  const memoryContext =await buildMemoryContext();
  const systemPrompt = buildSystemPrompt(memoryContext);

  const userPrompt = `Original goal: ${goal.objective} 
    Previous plan:
    ${JSON.stringify(previousPlan,null,2)}
    Execution result:
    ${JSON.stringify(observation,null,2)} The previous plan failed.Create a better plan.Return only valid JSON.`;

  return askLLM(systemPrompt,userPrompt);
}