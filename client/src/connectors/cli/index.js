import { env } from "../../config/env.js";
import { createPrompt, showPrompt, printMessage } from "./prompt.js";
import { handleCommand } from "./commands.js";
import { connectToCloud, sendGoal, sendHumanReply } from "./transport.js";

console.clear();
console.log("\x1b[1m\x1b[36m==========================================\x1b[0m");
console.log("\x1b[1m\x1b[36m              Kairos Console              \x1b[0m");
console.log("\x1b[1m\x1b[36m==========================================\x1b[0m");
console.log("\x1b[90mType your goal or /help for commands.\x1b[0m\n");

const rl = createPrompt();

rl.on("SIGINT", () => {
  console.log("\nExiting Kairos Console...");
  process.exit(0);
});

let isWaiting = false;
let pendingAskGoalId = null;

function startPrompt() {
  if (isWaiting) return;
  showPrompt(rl, (input) => {
    if (input.trim() === "") {
      startPrompt();
      return;
    }
    if (handleCommand(input, rl)) {
      startPrompt();
      return;
    }
    isWaiting = true;
    sendGoal(input);
  });
}

function promptForAnswer() {
  rl.question("\x1b[1m\x1b[33mYou> \x1b[0m", (answer) => {
    const goalId = pendingAskGoalId;
    pendingAskGoalId = null;
    sendHumanReply(goalId, answer);
  });
}

connectToCloud(env.CLOUD_URL || "ws://localhost:8080", {
  onResult(result, success) {
    isWaiting = false;
    printMessage("Kairos", result, !success);
    startPrompt();
  },
  onStatus(status) {
    printMessage("Kairos", status);
  },
  onAsk(prompt, goalId, secret) {
    pendingAskGoalId = goalId;
    printMessage("Kairos", `${prompt}${secret ? "\n(stored only on this computer)" : ""}`);
    promptForAnswer();
  }
});

startPrompt();
