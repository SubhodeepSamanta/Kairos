import { askLLM } from "../llm/provider.js";

export async function verifyGoal({
  goal,
  observation,
  observations
}) {

  // informational actions

  if (
    observation?.expected ===
    "page_read"
  ) {
    return {
      achieved: true
    };
  }

  if (
    observation?.action?.type ===
    "get_browser_context"
  ) {
    return {
      achieved: true
    };
  }

  if (
    observation?.expected ===
      "page_loaded" &&
    observation?.success
  ) {
    return {
      achieved: true
    };
  }
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
}`,
JSON.stringify({
  goal,
  observation,
  observations
})
);

  try {

    return JSON.parse(
      response
    );

  } catch {

    return {
      achieved: false
    };
  }
}