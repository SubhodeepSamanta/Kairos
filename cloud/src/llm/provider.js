import { askGroq } from "./groq.js";
import { askOpenRouter } from "./openrouter.js";
import { askNvidia } from "./nvidia.js";

export async function askLLM(
  systemPrompt,
  userPrompt
) {
  const providers = [
    askGroq,
    askOpenRouter,
    askNvidia
  ];

  let lastError = null;

  for (const provider of providers) {
    try {
      const response =
        await provider(
          systemPrompt,
          userPrompt
        );

      if (
        response &&
        response.trim()
      ) {
        return response;
      }
    }

    catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error(
      "No provider available"
    )
  );
}