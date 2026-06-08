import { saveMemory } from "./memory.js";

export async function storeMemory(memory) {

  if (!memory.store) {
    return null;
  }

  await saveMemory(
    memory.type,
    memory.key,
    memory.value
  );

  return `I'll remember that your ${memory.key} is ${memory.value}.`;
}