import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { callModel } = await import("../src/llm/models.js");
const { parseJsonResponse } = await import("../src/llm/provider.js");
const { SYSTEM_PROMPT, buildStepPrompt } = await import("../src/agent/prompt.js");
const { judge } = await import("./judge.js");

const MODEL = {
  name: process.env.EVAL_MODEL || "groq/openai/gpt-oss-120b",
  provider: process.env.EVAL_PROVIDER || "groq",
  model: process.env.EVAL_MODEL || "openai/gpt-oss-120b"
};
const RATE_LIMIT_WAIT_MS = 20000;
const PACE_MS = Number(process.env.EVAL_PACE_MS) || 7000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function decide(system, user) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const raw = await callModel(MODEL, system, user);
      const parsed = parseJsonResponse(raw);
      if (parsed) return parsed;
      if (attempt === 3) throw new Error("model never returned valid JSON");
    } catch (err) {
      if (!err.rateLimited && attempt === 3) throw err;
      if (err.rateLimited) {
        console.log(`        rate limited — waiting ${RATE_LIMIT_WAIT_MS / 1000}s (not switching models, that would skew the score)`);
        await sleep(RATE_LIMIT_WAIT_MS);
      }
    }
  }
  throw new Error("gave up after 4 attempts");
}

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));
const resultsFile = path.join(__dirname, "results.json");

const args = process.argv.slice(2);
const only = args.find(a => !a.startsWith("--"));
const repeats = Number((args.find(a => a.startsWith("--repeat=")) || "").split("=")[1]) || 1;
const GATE = Number(process.env.EVAL_GATE) || 90;

function promptFor(testCase) {
  return buildStepPrompt({
    goal: testCase.goal,
    memories: testCase.memories || "(nothing saved yet)",
    history: testCase.history || [],
    snapshot: testCase.snapshot,
    notice: testCase.notice || "",
    summary: testCase.summary || "",
    conversation: testCase.conversation || "",
    recentDays: testCase.recentDays || "",
    mood: testCase.mood || ""
  });
}

async function runCase(testCase) {
  try {
    const decision = await decide(SYSTEM_PROMPT, promptFor(testCase));
    return judge(decision, testCase.expect || {});
  } catch (err) {
    return { pass: false, type: null, why: `model error: ${err.message}` };
  }
}

const toRun = only ? cases.filter(c => c.id === only) : cases;
if (!toRun.length) {
  console.error(`no case called "${only}". known: ${cases.map(c => c.id).join(", ")}`);
  process.exit(1);
}

console.log(`\nreplaying ${toRun.length} recorded decision${toRun.length === 1 ? "" : "s"}${repeats > 1 ? ` x${repeats}` : ""} against ${MODEL.name}\n`);

const results = [];
let first = true;
for (const testCase of toRun) {
  const attempts = [];
  for (let i = 0; i < repeats; i++) {
    if (!first) await sleep(PACE_MS);
    first = false;
    attempts.push(await runCase(testCase));
  }
  const passed = attempts.filter(a => a.pass).length;
  const ok = passed === attempts.length;
  results.push({ id: testCase.id, why: testCase.why, passed, of: attempts.length, failures: attempts.filter(a => !a.pass) });
  console.log(`  ${ok ? "pass" : "FAIL"}  ${testCase.id}${repeats > 1 ? ` (${passed}/${repeats})` : ""}`);
  if (!ok) {
    console.log(`        ${testCase.why}`);
    for (const f of [...new Set(attempts.filter(a => !a.pass).map(a => a.why))]) console.log(`        ${f}`);
  }
}

const totalAttempts = results.reduce((n, r) => n + r.of, 0);
const totalPassed = results.reduce((n, r) => n + r.passed, 0);
const score = Math.round((totalPassed / totalAttempts) * 100);

const full = !only;
console.log(`\n===== EVAL: ${totalPassed}/${totalAttempts} decisions correct (${score}%, gate ${GATE}%) =====`);

const flaky = results.filter(r => r.passed > 0 && r.passed < r.of);
for (const r of flaky) {
  console.log(`  flaky: ${r.id} passed ${r.passed}/${r.of} — not a pass, the prompt is not pinning this down`);
}

if (full) {
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(resultsFile, "utf8")); } catch {}
  if (previous && typeof previous.score === "number" && previous.of === totalAttempts) {
    const delta = score - previous.score;
    console.log(`  last run ${String(previous.date).slice(0, 10)} on ${previous.model || "?"}: ${previous.score}% (${delta === 0 ? "no change" : delta > 0 ? `+${delta}` : delta})`);
  }
  fs.writeFileSync(resultsFile, JSON.stringify({
    date: new Date().toISOString(), model: MODEL.name, score, passed: totalPassed, of: totalAttempts, results
  }, null, 2));
  console.log(`  saved to ${resultsFile}`);
} else {
  console.log(`  single-case run — baseline in ${path.basename(resultsFile)} left untouched`);
}

process.exit(score < GATE ? 1 : 0);
