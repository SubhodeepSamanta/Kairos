import { askLLM }
    from "../llm/provider.js";

export async function summarizeResearch(
    query,
    content
) {

    const systemPrompt = `
You are Kairos Research.

Read all sources.

Produce:

1. Key findings
2. Important updates
3. Short summary

Use bullet points.
`;

    const userPrompt = `
Research Query:

${query}

Sources:

${content}
`;

    return askLLM(
        systemPrompt,
        userPrompt
    );
}