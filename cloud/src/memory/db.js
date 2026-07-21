import pg from "pg";
import { env } from "../config/env.js";

let pool = null;

export function hasDatabase() {
  return Boolean(env.DATABASE_URL);
}

export async function connectMemoryDb() {
  if (!hasDatabase()) return null;
  pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 25000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
    query_timeout: 15000,
    keepAlive: true
  });

  pool.on("error", (err) => {
    console.log(`[MEMORY] Idle database connection dropped (${err.message.slice(0, 60)}) — will reconnect on next write`);
  });
  await pool.query(`DROP TABLE IF EXISTS memories`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kairos_facts (
      memory_key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kairos_turns (
      id BIGSERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      said_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      role TEXT NOT NULL,
      text TEXT NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS kairos_turns_chat ON kairos_turns (chat_id, said_at DESC)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kairos_events (
      id BIGSERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      summary TEXT NOT NULL,
      success BOOLEAN,
      steps INT
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS kairos_events_chat ON kairos_events (chat_id, happened_at DESC)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kairos_moods (
      id BIGSERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      noted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      label TEXT NOT NULL,
      confidence REAL NOT NULL,
      why TEXT
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS kairos_moods_chat ON kairos_moods (chat_id, noted_at DESC)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kairos_prefs (
      chat_id TEXT PRIMARY KEY,
      persona TEXT,
      mood_tracking BOOLEAN NOT NULL DEFAULT TRUE,
      summary TEXT,
      covered_turns INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE kairos_prefs ADD COLUMN IF NOT EXISTS summary TEXT`);
  await pool.query(`ALTER TABLE kairos_prefs ADD COLUMN IF NOT EXISTS covered_turns INT NOT NULL DEFAULT 0`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kairos_digests (
      chat_id TEXT NOT NULL,
      day TEXT NOT NULL,
      line TEXT NOT NULL,
      PRIMARY KEY (chat_id, day)
    )
  `);
  return pool;
}

export function memoryPool() {
  return pool;
}

export async function loadAllFromDb() {
  if (!pool) return {};
  const { rows } = await pool.query("SELECT memory_key, value, updated_at FROM kairos_facts");
  const out = {};
  for (const row of rows) {
    out[row.memory_key] = { value: row.value, updatedAt: new Date(row.updated_at).toISOString() };
  }
  return out;
}

export async function upsertFact(key, value) {
  if (!pool) return false;
  await pool.query(
    `INSERT INTO kairos_facts (memory_key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (memory_key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
  return true;
}

export async function deleteFact(key) {
  if (!pool) return false;
  await pool.query("DELETE FROM kairos_facts WHERE memory_key = $1", [key]);
  return true;
}

export async function closeMemoryDb() {
  if (pool) await pool.end().catch(() => {});
  pool = null;
}

export function isDbActive() {
  return pool !== null;
}
