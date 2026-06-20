import { askLLM } from "../llm/provider.js";

export async function verifyGoal({
  goal,
  task,
  intent,
  observation,
  observations
}) {
  if (goal?.tasks?.some(t => t.status !== "completed")) {
    return { achieved: false };
  }

  if (observation?.action?.type === "get_browser_context") {
    return { achieved: true };
  }

  const response = await askLLM(
    `You verify whether a user's goal was achieved.

Return ONLY valid JSON.

Format:

{
  "achieved": true
}

or

{
  "achieved": false
}`,
    JSON.stringify({
      goal: goal?.objective,
      task,
      intent,
      observation,
      observations
    })
  );

  try {
    return JSON.parse(response);
  } catch {
    return { achieved: false };
  }
}
