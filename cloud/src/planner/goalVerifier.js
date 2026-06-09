import { askLLM } from "../llm/provider.js";

export async function verifyGoal({
  goal,
  observation
}) {

  const response =
    await askLLM(
`You verify whether a goal was achieved.

Return ONLY JSON.

Examples:

Goal:
search youtube for lofi

Observation:
{
  "url":"https://youtube.com/results?search_query=lofi"
}

Response:
{
  "achieved": true
}

Goal:
click banana

Observation:
{
  "actual":"unchanged"
}

Response:
{
  "achieved": false
}`,
JSON.stringify({
  goal,
  observation
})
);

  try {
    return JSON.parse(response);
  } catch {
    return {
      achieved: false
    };
  }
}