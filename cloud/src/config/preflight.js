import { env as defaultEnv } from "./env.js";

const LLM_KEYS = ["GROQ_API_KEY", "OPENROUTER_API_KEY", "NVIDIA_API_KEY"];

function has(value) {
  return Boolean(value && String(value).trim());
}

export function cloudPreflight(env = defaultEnv) {
  const problems = [];
  const notes = [];

  const presentKeys = LLM_KEYS.filter(k => has(env[k]));
  if (!presentKeys.length) {
    problems.push(
      "No LLM API key found — Kairos cannot think without one.",
      "  Get a free key at https://console.groq.com/keys",
      "  Then add it to cloud/.env:  GROQ_API_KEY=gsk_...",
      "  (OPENROUTER_API_KEY or NVIDIA_API_KEY also work.)"
    );
  } else {
    notes.push(`LLM: ${presentKeys.map(k => k.replace("_API_KEY", "").toLowerCase()).join(", ")}`);
  }

  if (!has(env.CLIENT_SECRET)) {
    notes.push("Auth: OFF (CLIENT_SECRET blank). Fine locally; set it to lock down the client.");
  } else {
    notes.push("Auth: on (client must send the matching CLIENT_SECRET)");
  }

  notes.push(has(env.TELEGRAM_BOT_TOKEN) ? "Telegram: enabled" : "Telegram: off — CLI only");
  notes.push(has(env.DATABASE_URL) ? "Memory: Postgres" : "Memory: local JSON (cloud/data/)");
  notes.push(`Port: ${env.PORT || 3000}`);

  return { ok: problems.length === 0, problems, notes };
}

export function reportPreflight(report, label = "Kairos cloud") {
  console.log(`\n${label} — startup check`);
  for (const note of report.notes) console.log(`  ✓ ${note}`);
  if (!report.ok) {
    console.log("\n  ✗ Cannot start:");
    for (const line of report.problems) console.log(`    ${line}`);
    console.log("");
  }
  return report.ok;
}
