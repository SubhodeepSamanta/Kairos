import { env } from "../../config/env.js";
import { createInput } from "./input.js";
import { colors as C } from "./menu.js";
import { connectToCloud, sendGoal, sendHumanReply, requestSuggestions, sendVoiceMode, sendCancel } from "./transport.js";
import { createVoiceController, isVoiceCommand, localCommandHelp } from "../../voice/cli.js";
import { voiceConfig } from "../../voice/config.js";

console.clear();
console.log(`${C.bold}${C.cyan}  Kairos${C.reset}`);
console.log(`${C.dim}  type / for commands · voice to talk out loud${C.reset}\n`);

let pendingAskGoalId = null;
let waitingForAnswer = false;
let goalInFlight = false;

const STOP_TYPED = /^\/?(?:stop|cancel|abort)$/i;
const HELP_TYPED = /^\/?help$/i;
let askedForHelp = false;

const voice = createVoiceController({
  write: (text) => ui.write(`${C.dim}${text}${C.reset}`),
  sendGoal: (text, tone) => { goalInFlight = true; sendGoal(text, tone); },
  onModeChange: (on) => sendVoiceMode(on),
  onCancel: () => sendCancel(),
  isBusy: () => goalInFlight
});

const ui = createInput({
  onSubmit(text) {
    if (waitingForAnswer) {
      const goalId = pendingAskGoalId;
      waitingForAnswer = false;
      pendingAskGoalId = null;
      sendHumanReply(goalId, text);
      return;
    }
    if (isVoiceCommand(text)) {
      voice.handle(text).finally(() => ui.prompt());
      return;
    }
    voice.interrupt();
    if (STOP_TYPED.test(text.trim())) {
      if (!goalInFlight) ui.write(`${C.dim}  nothing is running${C.reset}`);
      else sendCancel();
      ui.prompt();
      return;
    }
    askedForHelp = HELP_TYPED.test(text.trim());
    goalInFlight = true;
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
    if (voice.isActive()) {
      sendVoiceMode(true);
      return;
    }
    if (voiceConfig.enabled) voice.handle("voice").finally(() => ui.prompt());
  },
  onLink(note) {
    ui.write(`${C.dim}  ${note}${C.reset}`);
  },
  onResult(result, success, spoken) {
    goalInFlight = false;
    if (askedForHelp) {
      askedForHelp = false;
      say(result, !success);
      ui.write(`${C.dim}
on this computer:
${localCommandHelp()}${C.reset}`);
      ui.prompt();
      return;
    }
    const heard = voice.speak(spoken || result);
    say(heard || result, !success);
    ui.prompt();
  },
  onPersona(persona) {
    if (persona?.voice) voice.setPersona(persona.voice);
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
