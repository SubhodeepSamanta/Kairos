const dotenv = require("dotenv");
dotenv.config();
const pg = require("pg");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 30000
});

(async () => {
  const tables = async () => {
    const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    return rows.map(r => r.tablename);
  };

  const before = await tables();
  console.log("tables before:", before.join(", "));

  if (before.includes("memories")) {
    const { rows } = await pool.query("SELECT COUNT(*)::INT AS n FROM memories");
    console.log(`legacy memories table has ${rows[0].n} rows — dropping`);
    await pool.query("DROP TABLE memories");
    console.log("dropped.");
  } else {
    console.log("legacy memories table not present — nothing to drop");
  }

  const after = await tables();
  console.log("tables after:", after.join(", "));

  const expected = ["kairos_digests", "kairos_events", "kairos_facts", "kairos_moods", "kairos_prefs", "kairos_turns"];
  const missing = expected.filter(t => !after.includes(t));
  if (missing.length) {
    console.log("WARNING missing kairos tables:", missing.join(", "));
    process.exit(1);
  }
  const { rows: factRows } = await pool.query("SELECT COUNT(*)::INT AS n FROM kairos_facts");
  console.log(`kairos tables intact, ${factRows[0].n} facts still stored`);
  await pool.end();
})().catch(err => {
  console.error("failed:", err.message);
  process.exit(1);
});
