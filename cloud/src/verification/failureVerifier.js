import { askLLM } from "../llm/provider.js";

export async function isGoalImpossible({
  intent,
  observations
}) {
  const response = await askLLM(
    `Determine whether the goal is impossible
from the current page state.

Return ONLY JSON.

{
  "impossible": true
}

or

{
  "impossible": false
}
  
If the requested element does not exist
on the current page and cannot reasonably
be reached from the current page,
return:

{
  "impossible": true
}`,
    JSON.stringify({
      intent,
      observations
    })
  );

  try {
    return JSON.parse(response);
  } catch {
    return { impossible: false };
  }
}
