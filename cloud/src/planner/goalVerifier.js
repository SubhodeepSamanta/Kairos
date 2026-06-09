import { askLLM } from "../llm/provider.js";

export async function verifyGoal({
  goal,
  observation, observations,
}) {

  const response =
    await askLLM(
`You verify whether a user's goal was achieved.

Return ONLY valid JSON.

Format:

{
  "achieved": true
}

or

{
  "achieved": false
}

Examples:

Goal:
search youtube for lofi

Browser Context:
{
  "title":"lofi - YouTube",
  "url":"https://youtube.com/results?search_query=lofi"
}

Response:
{
  "achieved": true
}

Goal:
click banana

Browser Context:
{
  "title":"YouTube"
}

Response:
{
  "achieved": false
}`,
JSON.stringify({
  goal,
  observation,
  observations
})
);

  try {
    return JSON.parse(response);
  }

  catch {

    return {
      achieved: false
    };
  }
}