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
const only = process.argv[2] ? Number(process.argv[2]) : null;
const url = process.env.CLOUD_URL || `ws://localhost:${process.env.PORT || 3000}`;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

function runGoal(ws, goal) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ success: false, result: "benchmark timeout (6 min)" }), 360000);
    const onMessage = async (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "goal_status") {
        console.log(`   ⏳ ${msg.status}`);
      } else if (msg.type === "human_input_request") {
        const answer = await ask(`   ❓ ${msg.prompt}\n   your answer> `);
        ws.send(JSON.stringify({ type: "human_input_response", goalId: msg.goalId, input: answer }));
      } else if (msg.type === "goal_result") {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve({ success: msg.success, result: msg.result });
      }
    };
    ws.on("message", onMessage);
    ws.send(JSON.stringify({ type: "goal", goal }));
  });
}

const ws = new WebSocket(url);
ws.on("open", () => ws.send(JSON.stringify({ type: "register_connector", name: "benchmark", secret: process.env.CLIENT_SECRET })));
ws.on("error", (e) => { console.error(`Cannot reach cloud at ${url}: ${e.message}`); process.exit(1); });

ws.on("message", async function onRegistered(raw) {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "auth_failed") { console.error("Auth failed — check CLIENT_SECRET"); process.exit(1); }
  if (msg.type !== "registered") return;
  ws.off("message", onRegistered);

  const toRun = only ? tasks.filter(t => t.id === only) : tasks;
  const results = [];

  for (const task of toRun) {
    console.log(`\n▶ Task ${task.id}: ${task.goal}`);
    const { success, result } = await runGoal(ws, task.goal);
    console.log(`   ${success ? "✅" : "❌"} agent says: ${result.slice(0, 300)}`);
    const verdict = (await ask("   did it actually work? (y/n) ")).trim().toLowerCase().startsWith("y");
    results.push({ id: task.id, goal: task.goal, agentSuccess: success, humanVerdict: verdict, answer: result.slice(0, 500) });
  }

  const passed = results.filter(r => r.humanVerdict).length;
  console.log(`\n===== BENCHMARK: ${passed}/${results.length} passed (gate: 8/10) =====`);
  fs.writeFileSync(resultsFile, JSON.stringify({ date: new Date().toISOString(), passed, total: results.length, results }, null, 2));
  console.log(`Saved to ${resultsFile}`);
  rl.close();
  ws.close();
  process.exit(0);
});
