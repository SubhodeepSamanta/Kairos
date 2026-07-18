import { env } from "../../config/env.js";
import { createInput } from "./input.js";
import { colors as C } from "./menu.js";
import { connectToCloud, sendGoal, sendHumanReply, requestSuggestions } from "./transport.js";

console.clear();
console.log(`${C.bold}${C.cyan}  Kairos${C.reset}`);
console.log(`${C.dim}  type / for commands · just talk otherwise${C.reset}\n`);

let pendingAskGoalId = null;
let waitingForAnswer = false;

const ui = createInput({
  onSubmit(text) {
    if (waitingForAnswer) {
      const goalId = pendingAskGoalId;
      waitingForAnswer = false;
      pendingAskGoalId = null;
      sendHumanReply(goalId, text);
      return;
    }
    sendGoal(text);
  },
  onSuggest(text) {
    requestSuggestions(text);
  }
});

function say(text, isError = false) {
  const color = isError ? "\x1b[31m" : C.cyan;
  ui.write(`${color}${text}${C.reset}`);
}

connectToCloud(env.CLOUD_URL || "ws://localhost:3000", {
  onReady() {
    ui.prompt();
  },
  onResult(result, success) {
    say(result, !success);
    ui.prompt();
  },
  onStatus(status) {
    ui.write(`${C.dim}  ${status}${C.reset}`);
  },
  onAsk(prompt, goalId, secret) {
    pendingAskGoalId = goalId;
    waitingForAnswer = true;
    say(`${prompt}${secret ? `\n${C.dim}(stored only on this computer)${C.reset}` : ""}`);
    ui.prompt();
  },
  onSuggestions(suggestions) {
    ui.showSuggestions(suggestions);
  }
});
