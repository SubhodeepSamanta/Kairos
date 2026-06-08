import { query } from "../database/queries.js";

export async function retrieveMemory(message) {

  const lower =
    message.toLowerCase()
      .trim();

  const isQuestion =
    lower.includes("?") ||
    lower.startsWith("what") ||
    lower.startsWith("which") ||
    lower.startsWith("who");

  if (!isQuestion) {
    return null;
  }

  const rows =
    await query(
      `
      SELECT *
      FROM memories
      ORDER BY updated_at DESC
      `
    );

  for (const row of rows) {

    const key =
      row.memory_key
        .toLowerCase();

    if (
      lower.includes(key)
    ) {
      return `Your ${row.memory_key} is ${row.value}.`;
    }
  }

  return null;
}