import { askLLM } from "../llm/provider.js";
import { createTask } from "../shared/schemas/task.js";
import { parseGoal } from "./goalParser.js";

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

export async function buildTaskGraph(goal, browserState = {}) {

  const systemPrompt = `
You are a task decomposition engine.

Break a user goal into smaller executable tasks.
Each task must represent a single objective.

Do not generate browser actions.
Do not generate clicks.
Do not generate navigation steps.
Generate semantic tasks only.

Each task MUST include:
- objective: a clear description of what this task must achieve. If the goal involves multiple websites or tabs, decompose it into separate tasks for each tab or switch operation.
- successCriteria: array of concrete, human-readable conditions that are directly observable on the page (e.g. "URL contains youtube.com/watch", "Search input contains react", "Page title contains Search", "Link with text 'Home' is visible").
  CRITICAL RULES:
  1. Never use unobservable states like "video is playing", "user logged in", "audio is active", "connection successful".
  2. All success criteria MUST be verifiable using only: URL path fragments, page title substring, presence of specific DOM text, or the presence of specific buttons/inputs/links.
  3. If a task switches tabs, include a criterion verifying that the active tab's URL/title matches the target site.
- requires: array of prerequisite conditions (e.g. "youtube_open", "search_results_visible")
- produces: array of conditions this task creates for downstream tasks

Current Browser State:
URL: ${browserState.url || "unknown"}
Title: ${browserState.title || "unknown"}
Page Type: ${browserState.pageType || "generic"}

If the browser is already on the target website homepage or results page, DO NOT generate a task to navigate to that page. Skip directly to downstream tasks.

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
    ).map(task => {
      const parsedIntent = parseGoal(task.objective);
      return createTask({
        objective:
          task.objective,

        intent:
          parsedIntent,

        context:
          task.context || {},

        successCriteria:
          task.successCriteria || [],

        requires:
          task.requires || [],

        produces:
          task.produces || []
      });
    });

  } catch (error) {

  console.error(
    "TASK PARSE ERROR:",
    error
  );

  return [
    createTask({
      objective:
        goal.objective,

      intent:
        goal.intent,

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