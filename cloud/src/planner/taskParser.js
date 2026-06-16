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

Each task MUST include:
- objective: a clear description of what this task must achieve
- successCriteria: array of concrete, human-readable conditions that are directly observable on the page (e.g., "URL contains youtube.com/watch", "Search input contains react", "Page title contains Search", "Link with text 'Home' is visible"). NEVER use unobservable internal states like "video is playing" or "server has processed request". Everything must be verifiable via URL, title, or DOM elements.
- requires: array of prerequisite conditions (e.g. "youtube_open", "search_results_visible")
- produces: array of conditions this task creates for downstream tasks

Example:

Goal:
Find a greek video and watch it

Response:

{
  "tasks": [
    {
      "objective": "Open YouTube homepage",
      "successCriteria": ["YouTube homepage is visible"],
      "requires": [],
      "produces": ["youtube_open"]
    },
    {
      "objective": "Search for a greek video on YouTube",
      "successCriteria": ["search results are visible", "results relate to greek video"],
      "requires": ["youtube_open"],
      "produces": ["search_results_visible"]
    },
    {
      "objective": "Open a Greek video from results",
      "successCriteria": ["a video page is open", "video is playing or ready to play"],
      "requires": ["search_results_visible"],
      "produces": ["video_open"]
    }
  ]
}
Return ONLY valid JSON.

Format:

{
  "tasks": [
    {
      "objective": "",
      "successCriteria": [],
      "requires": [],
      "produces": [],
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
        objective:
          task.objective,

        context:
          task.context || {},

        successCriteria:
          task.successCriteria || [],

        requires:
          task.requires || [],

        produces:
          task.produces || []
      })
    );

  } catch (error) {

  console.error(
    "TASK PARSE ERROR:",
    error
  );

  return [
    createTask({
      objective:
        goal.objective,

      context: {
        entities:
          goal.intent.entities,

        constraints:
          goal.intent.constraints
      },

      successCriteria: [
        "goal objective is achieved"
      ]
    })
  ];
}
}