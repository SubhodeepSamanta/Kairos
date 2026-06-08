import { askLLM } from "../llm/provider.js";

export async function chatReply(message) {
  return askLLM(
    `You are Kairos.

You are a friendly personal AI assistant.

Keep replies conversational and concise.`,
    message
  );
}