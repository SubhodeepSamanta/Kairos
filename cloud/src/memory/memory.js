import { query } from "../database/queries.js";

export async function saveMemory(
  type,
  key,
  value
) {

  const existing =
    await query(
      `
      SELECT id
      FROM memories
      WHERE memory_key = $1
      LIMIT 1
      `,
      [key]
    );

  if (existing.length > 0) {

    await query(
      `
      UPDATE memories
      SET
        value = $1,
        type = $2,
        updated_at = NOW()
      WHERE memory_key = $3
      `,
      [
        value,
        type,
        key
      ]
    );

    return;
  }

  await query(
    `
    INSERT INTO memories
    (
      type,
      memory_key,
      value
    )
    VALUES
    (
      $1,
      $2,
      $3
    )
    `,
    [
      type,
      key,
      value
    ]
  );
}

export async function getMemory(
  key
) {
  const rows = await query(
    `
    SELECT *
    FROM memories
    WHERE memory_key = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [key]
  );

  return rows[0] || null;
}

export async function searchMemories(
  queryText
) {

  const rows =
    await query(
      `
      SELECT *
      FROM memories
      ORDER BY updated_at DESC
      `
    );

  queryText =
    queryText.toLowerCase();

  for (const row of rows) {

    const key =
      row.memory_key
        .toLowerCase();

    if (
      queryText.includes(key)
    ) {
      return row;
    }
  }

  return null;
}