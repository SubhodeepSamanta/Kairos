import { askGroq } from "./groq.js";
import { askOpenRouter } from "./openrouter.js";
import { askNvidia } from "./nvidia.js";

export async function askLLM(
  systemPrompt,
  userPrompt
) {
  const providers = [
    askOpenRouter,
    askGroq,
    askNvidia
  ];

  let lastError = null;

for (const provider of providers) {

  console.log(
    `[LLM] Trying ${provider.name}`
  );

  try {

    const response =
      await provider(
        systemPrompt,
        userPrompt
      );

    console.log(
      `[LLM] Success ${provider.name}`
    );

    if (
      response &&
      response.trim()
    ) {
      return response;
    }
  }

  catch (error) {

    console.log(
      `[LLM] Failed ${provider.name}`,
      error.message
    );

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