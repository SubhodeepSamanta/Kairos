const dotenv = require("dotenv");
dotenv.config();
const WebSocket = require("ws");

const goals = process.argv.slice(2);
if (!goals.length) {
  console.log("usage: node e2e-check.cjs \"goal one\" [\"goal two\" ...]");
  process.exit(1);
}

const ws = new WebSocket(`ws://localhost:${process.env.PORT || 3000}`);
let index = 0;
let timer = null;

function fail(reason) {
  console.log(`E2E FAIL: ${reason}`);
  process.exit(1);
}

function armTimeout() {
  clearTimeout(timer);
  timer = setTimeout(() => fail(`no result for "${goals[index]}" within 120s`), 120000);
}

function sendNext() {
  if (index >= goals.length) {
    console.log("E2E PASS: all goals completed");
    ws.close();
    process.exit(0);
  }
  console.log(`\n>>> goal ${index + 1}/${goals.length}: ${goals[index]}`);
  armTimeout();
  ws.send(JSON.stringify({ type: "goal", goal: goals[index] }));
}

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "register_connector", name: "e2e", secret: process.env.CLIENT_SECRET }));
});

ws.on("message", (raw) => {
  const data = JSON.parse(raw.toString());
  if (data.type === "registered") {
    console.log("connector registered");
    sendNext();
  } else if (data.type === "auth_failed") {
    fail("auth failed");
  } else if (data.type === "goal_status") {
    console.log(`  [status] ${data.status}`);
  } else if (data.type === "human_input_request") {
    fail(`unexpected ask_human: ${data.prompt}`);
  } else if (data.type === "goal_result") {
    clearTimeout(timer);
    console.log(`  [result] success=${data.success}: ${String(data.result).slice(0, 300)}`);
    if (!data.success) fail(`goal "${goals[index]}" reported failure`);
    index++;
    setTimeout(sendNext, 1500);
  }
});

ws.on("error", (err) => fail(`socket error: ${err.message}`));
