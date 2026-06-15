
import { askLLM } from "../llm/provider.js";

export async function verifyTask({
  task,
  observation,
  world
}) {

  const criteria =
    task.successCriteria || [];

  if (criteria.length === 0) {
    return {
      achieved:
        observation?.success !== false,
      confidence: 0.5,
      reason: "No success criteria defined. Using basic success check."
    };
  }

  const systemPrompt = `
You verify whether a browser task succeeded.

You receive:
- task: what was attempted
- successCriteria: conditions that must be true
- browserState: current page state
- world: accumulated knowledge from prior tasks

Evaluate EACH criterion against the browser state and world.

Return ONLY valid JSON:

{
  "achieved": true or false,
  "confidence": 0.0 to 1.0,
  "evidence": [
    "explicit URL fragments",
    "exact visible text matched",
    "specific elements observed"
  ],
  "reason": "brief explanation showing exactly why based on evidence",
  "criteriaResults": [
    {
      "criterion": "the criterion text",
      "met": true or false
    }
  ]
}

A task is achieved ONLY if ALL criteria are met.

Rules:
- Never infer.
- Never assume.
- Never guess.
- Use only evidence present in browserState or world.
- Previous task completion is not evidence.
- If evidence is missing, return achieved=false.
- If uncertain, return achieved=false.
- A criterion is satisfied only if direct evidence exists.
- Banned success reasons: "task completed", "informational action completed", "action succeeded". You must specify the concrete page indicators/evidence (e.g. "watch?v=", video/audio playing markers, visible results).

Evidence hierarchy:
1. URL
2. Page title
3. Visible text
4. Structured elements

If evidence is missing:
met = false

Never infer success from intent.
Never infer success from previous tasks.
Never infer success from user goals.

Specific Verification Rules:
- If the objective is to type, input, fill, or enter text, the success criteria MUST NOT be marked met unless the browser state explicitly shows a matching input element containing the correct value in its "value" property. URL/title changes are NOT sufficient evidence for text-entry objectives.
`;

  const userPrompt = JSON.stringify({
    task: {
      objective: task.objective
    },

    successCriteria: criteria,

    browserState: observation?.pageState || observation,

    world: {
      lastUrl: world?.lastUrl,
      lastTitle: world?.lastTitle,
      completedTasks:
        world?.completedTasks?.map(
          t => `${t.objective}`
        ) || []
    }
  }, null, 2);

  try {

    const response =
      await askLLM(
        systemPrompt,
        userPrompt
      );

    const parsed =
      JSON.parse(
        extractJson(response)
      );

    return {
      achieved:
        parsed.achieved === true,
      confidence:
        parsed.confidence || 0,
      reason:
        parsed.reason || "",
      criteriaResults:
        parsed.criteriaResults || []
    };

  } catch (error) {

    console.error(
      "TASK VERIFY ERROR:",
      error.message
    );

    return {
      achieved: false,
      confidence: 0,
      reason: "Verification failed: " + error.message
    };
  }
}

function extractJson(text) {

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  if (start === -1) return text;

  return text.slice(
    start,
    end + 1
  );
}
