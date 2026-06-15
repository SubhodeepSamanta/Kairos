import { askLLM } from "../llm/provider.js";
import { createTask } from "../shared/schemas/task.js";

    function extractJson(text) {

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  return text.slice(
    start,
    end + 1
  );
}

export async function buildTaskGraph(goal) {

  const systemPrompt = `
You are a task decomposition engine.

Break a user goal into smaller executable tasks.
Each task must represent a single objective.

Do not generate browser actions.

Do not generate clicks.

Do not generate navigation steps.

Generate semantic tasks only.

Example:

Goal:
Find a greek video and summarize it

Response:

{
  "tasks": [
    {
      "intent": "open_site",
      "target": "youtube"
    },
    {
      "intent": "search",
      "target": "greek video"
    },
    {
      "intent": "open_result"
    },
    {
      "intent": "extract_content"
    },
    {
      "intent": "summarize"
    }
  ]
}
Return ONLY valid JSON.

Format:

{
  "tasks": [
    {
      "intent": "",
      "target": "",
      "context": {}
    }
  ]
}
`;

  const response =
    await askLLM(
      systemPrompt,
      goal.objective
    );

  try {
const parsed =
  JSON.parse(
    extractJson(response)
  );

    return (
      parsed.tasks || []
    ).map(task =>
      createTask({
        intent:
          task.intent,

        target:
          task.target,

        context:
          task.context || {}
      })
    );

  } catch {
console.log(
  "TASK GRAPH:",
  JSON.stringify(
    parsed.tasks,
    null,
    2
  )
);
    return [
      createTask({
        intent:
          goal.intent.type,

        target:
          goal.intent.target,

        context: {
          entities:
            goal.intent.entities,

          constraints:
            goal.intent.constraints
        }
      })
    ];
  }
}