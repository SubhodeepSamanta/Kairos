import { query } from "../database/queries.js";

export async function retrieveMemory(message) {

  const lower = message
    .toLowerCase()
    .trim();

  const rows = await query(`
    SELECT *
    FROM memories
    ORDER BY updated_at DESC
  `);

  for (const row of rows) {

    const key = row.memory_key
      .toLowerCase();

    const patterns = [
      `what is my ${key}`,
      `what's my ${key}`,
      `which ${key} do i use`,
      `what ${key} do i use`,
      `my ${key}`
    ];

    const matched =
      patterns.some(
        pattern => lower === pattern
      );

    if (matched) {
      return `Your ${row.memory_key} is ${row.value}.`;
    }
  }

  return null;
}