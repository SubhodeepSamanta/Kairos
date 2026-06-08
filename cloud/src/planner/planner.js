import { askLLM } from "../llm/provider.js";
import { createPlan } from "../shared/schemas/plan.js";
import { SYSTEM_PROMPT } from "./prompts/systemPrompt.js";
import { validatePlan } from "./validator.js";

export async function createGoalPlan(goal) {
    const response = await askLLM(
        SYSTEM_PROMPT,
        goal.objective
    );

    let parsed;

    try {
        parsed = JSON.parse(
            extractJson(response)
        );
    }

    catch {
        return createPlan(
            goal.id,
            []
        );
    }

    if (
        !parsed ||
        !Array.isArray(
            parsed.actions
        )
    ) {
        return createPlan(
            goal.id,
            []
        );
    }

    const validated = validatePlan(parsed);

    return createPlan(
        goal.id,
        validated.actions
    );
}

function extractJson(text) {
    const start =
        text.indexOf("{");

    const end =
        text.lastIndexOf("}");

    if (
        start === -1 ||
        end === -1
    ) {
        throw new Error(
            "No JSON found"
        );
    }

    return text.slice(
        start,
        end + 1
    );
}