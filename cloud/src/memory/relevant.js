import { query } from "../database/queries.js";

export async function retrieveRelevantMemories(
  intent
) {

  const rows =
    await query(`
      SELECT *
      FROM memories
    `);

  const terms =
  intent.entities || [];

  const ranked = [];

  for (const row of rows) {

    const text = `
      ${row.type}
      ${row.memory_key}
      ${row.value}
    `.toLowerCase();

    let score = 0;

    for (const term of terms) {

      if (
        text.includes(term)
      ) {
        score += 1;
      }
    }

    if (score > 0) {

      ranked.push({
        ...row,
        score
      });
    }
  }

  ranked.sort(
    (a, b) =>
      b.score - a.score
  );

  const result =
  ranked
    .slice(0, 5)
    .map(
      row =>
        `${row.memory_key}=${row.value}`
    )
    .join("\n");

return result;
}