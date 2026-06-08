import { db } from "./connection.js";

export async function query(
  text,
  params = []
) {
  const result =
    await db.query(
      text,
      params
    );

  return result.rows;
}