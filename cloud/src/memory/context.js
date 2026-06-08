import { query } from "../database/queries.js";

export async function buildMemoryContext() {

  const memories =
    await query(
      `
      SELECT *
      FROM memories
      ORDER BY updated_at DESC
      LIMIT 50
      `
    );

  if (
    memories.length === 0
  ) {
    return "";
  }

  const lines = [];

  for (const memory of memories) {
    lines.push(
      `${memory.memory_key}=${memory.value}`
    );
  }

  return lines.join("\n");
}