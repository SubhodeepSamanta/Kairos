import { askLLM } from "../llm/provider.js";

export async function extractDataFromPage(pageText, query) {
  const systemPrompt = `You are a data extraction assistant. Extract the requested information from the provided page text. Return the output as a clean JSON object containing the extracted fields. Do not include markdown formatting or quotes outside of valid JSON.`;
  const userPrompt = `Query: ${query}\n\nPage Text:\n${pageText}`;
  
  const response = await askLLM(systemPrompt, userPrompt);
  try {
    // Extract JSON block if LLM returned markdown wrapped JSON
    const objectStart = response.indexOf("{");
    const end = response.lastIndexOf("}");
    if (objectStart !== -1 && end !== -1) {
      return JSON.parse(response.slice(objectStart, end + 1));
    }
    return JSON.parse(response);
  } catch {
    return { data: response.trim() };
  }
}
