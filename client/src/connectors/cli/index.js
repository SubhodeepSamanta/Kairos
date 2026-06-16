import { createPrompt, showPrompt, printMessage } from "./prompt.js";
import { handleCommand } from "./commands.js";
import { connectToCloud, sendGoal } from "./transport.js";

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

    // Treat as goal
    isWaiting = true;
    sendGoal(input);
  });
}

connectToCloud(
  "ws://localhost:8080",
  (result, success) => {
    isWaiting = false;
    printMessage("Kairos", result, !success);
    startPrompt();
  },
  (status) => {
    printMessage("Kairos", status);
  }
);

startPrompt();
