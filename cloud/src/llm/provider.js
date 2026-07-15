import { askGroq } from "./groq.js";
import { askOpenRouter } from "./openrouter.js";
import { askNvidia } from "./nvidia.js";
import contextManager from "../utils/contextManager.js";

export let llmCallCount = 0;
export let maxLlmCalls = 80;

export function resetLlmCallCount() {
  llmCallCount = 0;
}

export async function askLLM(
  systemPrompt,
  userPrompt,
  contextId = null
) {
  try {
    let actualContextId = contextId;
    if (!actualContextId) {
      const contextObj = contextManager.createContext({
        timestamp: Date.now(),
        source: 'llm_call'
      });
      actualContextId = contextObj.id;
    }

    if (llmCallCount >= maxLlmCalls) {
      throw new Error(`LLM Call Budget Exceeded: limit of ${maxLlmCalls} calls reached.`);
    }
    llmCallCount++;

    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const userTokens = Math.ceil(userPrompt.length / 4);
    console.log(
      `[LLM] Call #${llmCallCount} - System: ${systemTokens} tokens, User: ${userTokens} tokens, Total: ${systemTokens + userTokens} tokens`
    );

    const providers = [
      askGroq,
      askOpenRouter,
      askNvidia
    ];

    let lastError = null;

    for (const provider of providers) {
      console.log(
        `[LLM] Trying ${provider.name}`
      );

      try {
        const result = await contextManager.makeLLMCall(
          actualContextId,
          systemPrompt,
          userPrompt,
          async (sysPrompt, usrPrompt, ctx) => {
            return await provider(sysPrompt, usrPrompt);
          }
        );

        console.log(
          `[LLM] Success ${provider.name}`
        );

        if (
          result &&
          result.trim()
        ) {
          return result;
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

  } catch (error) {
    console.error(
      `[LLM] Fatal error in askLLM:`,
      error.message
    );
    throw error;
  }
}
