import fs from "fs";
import path from "path";
import readline from "readline";
import WebSocket from "ws";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, "tasks.json"), "utf8"));
const resultsFile = path.join(__dirname, "results.json");

const args = process.argv.slice(2);
const auto = args.includes("--auto");
const only = args.map(Number).find(n => Number.isFinite(n) && n > 0) || null;
const url = process.env.CLOUD_URL || `ws://localhost:${process.env.PORT || 3000}`;
const GATE = 8;

const rl = auto ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => auto ? Promise.resolve("") : new Promise(r => rl.question(q, r));

function runGoal(ws, task) {
  return new Promise((resolve) => {
    const asked = [];
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      resolve({ success: false, result: "benchmark timeout (6 min)", asked });
    }, 360000);

    const onMessage = async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "goal_status") {
        console.log(`   ⏳ ${msg.status}`);
        return;
      }
      if (msg.type === "human_input_request") {
        asked.push(msg.prompt);
        const answer = auto ? String(task.reply || "") : await ask(`   ❓ ${msg.prompt}\n   your answer> `);
        if (auto) console.log(`   ❓ ${msg.prompt}\n   auto-answer> ${answer || "(nothing)"}`);
        ws.send(JSON.stringify({ type: "human_input_response", goalId: msg.goalId, input: answer }));
        return;
      }
      if (msg.type === "goal_result") {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve({ success: msg.success, result: msg.result, asked });
      }
    };

    ws.on("message", onMessage);
    ws.send(JSON.stringify({ type: "goal", goal: task.goal }));
  });
}

function report(results) {
  const passed = results.filter(r => r.humanVerdict).length;
  const mode = auto ? "unattended, agent's own verdict" : "human verdict";
  console.log(`\n===== BENCHMARK: ${passed}/${results.length} passed (gate: ${GATE}/10, ${mode}) =====`);
  for (const r of results.filter(r => !r.humanVerdict)) {
    console.log(`  x ${r.id}. ${r.goal}\n      ${String(r.answer).slice(0, 160)}`);
  }

  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(resultsFile, "utf8")); } catch {}
  if (previous && typeof previous.passed === "number") {
    const delta = passed - previous.passed;
    const when = String(previous.date).slice(0, 10);
    const shift = delta === 0 ? "no change" : delta > 0 ? `+${delta}` : `${delta}`;
    console.log(`  last run ${when}: ${previous.passed}/${previous.total} (${shift})`);
  }

  fs.writeFileSync(resultsFile, JSON.stringify({
    date: new Date().toISOString(),
    mode: auto ? "auto" : "human",
    passed, total: results.length, results
  }, null, 2));
  console.log(`  saved to ${resultsFile}`);
  return passed;
}

const ws = new WebSocket(url);
ws.on("open", () => ws.send(JSON.stringify({ type: "register_connector", name: "benchmark", secret: process.env.CLIENT_SECRET })));
ws.on("error", (e) => { console.error(`Cannot reach cloud at ${url}: ${e.message}`); process.exit(1); });

ws.on("message", async function onRegistered(raw) {
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  if (msg.type === "auth_failed") { console.error("Auth failed — check CLIENT_SECRET"); process.exit(1); }
  if (msg.type !== "registered") return;
  ws.off("message", onRegistered);

  const toRun = only ? tasks.filter(t => t.id === only) : tasks;
  const results = [];

  for (const task of toRun) {
    console.log(`\n> Task ${task.id}: ${task.goal}`);
    const { success, result, asked } = await runGoal(ws, task);
    console.log(`   ${success ? "ok" : "failed"} — agent says: ${String(result).slice(0, 300)}`);
    const verdict = auto
      ? success
      : (await ask("   did it actually work? (y/n) ")).trim().toLowerCase().startsWith("y");
    results.push({
      id: task.id, goal: task.goal, agentSuccess: success,
      humanVerdict: verdict, asked, answer: String(result).slice(0, 500)
    });
  }

  const passed = report(results);
  rl?.close();
  ws.close();
  process.exit(auto && passed < GATE ? 1 : 0);
});
