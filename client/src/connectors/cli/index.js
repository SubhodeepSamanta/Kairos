import { env } from "../../config/env.js";
import { createInput } from "./input.js";
import { colors as C } from "./menu.js";
import { connectToCloud, sendGoal, sendHumanReply, requestSuggestions, sendVoiceMode, sendCancel, isLinked } from "./transport.js";
import { createGoalRouter } from "./router.js";
import { createVoiceController, isVoiceCommand, localCommandHelp } from "../../voice/cli.js";
import { voiceConfig } from "../../voice/config.js";

console.clear();
console.log(`${C.bold}${C.cyan}  Kairos${C.reset}`);
console.log(`${C.dim}  type / for commands · voice to talk out loud${C.reset}\n`);

const STOP_TYPED = /^\/?(?:stop|cancel|abort)$/i;
const HELP_TYPED = /^\/?help$/i;
const STATUS_TYPED = /^\/?status$/i;
let localFooter = null;

function footerFor(line) {
  if (HELP_TYPED.test(line)) return () => `on this computer:\n${localCommandHelp()}`;
  if (STATUS_TYPED.test(line)) return () => `on this computer:\n  ${voice.status()}\n  cloud: ${isLinked() ? "connected" : "not connected"}`;
  return null;
}

const router = createGoalRouter({ sendGoal, sendHumanReply, sendCancel });

const voice = createVoiceController({
  write: (text) => ui.write(`${C.dim}${text}${C.reset}`),
  sendGoal: (text, tone) => router.submit(text, tone),
  onModeChange: (on) => sendVoiceMode(on),
  onCancel: () => router.cancel(),
  isBusy: () => router.isBusy()
});

const ui = createInput({
  onSubmit(text) {
    if (router.isAwaitingAnswer()) {
      router.submit(text);
      return;
    }
    if (isVoiceCommand(text)) {
      voice.handle(text).finally(() => ui.prompt());
      return;
    }
    voice.interrupt();
    if (STOP_TYPED.test(text.trim())) {
      if (!router.cancel()) ui.write(`${C.dim}  nothing is running${C.reset}`);
      ui.prompt();
      return;
    }
    localFooter = footerFor(text.trim());
    router.submit(text);
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
    router.finish();
    if (localFooter) {
      const footer = localFooter();
      localFooter = null;
      say(result, !success);
      ui.write(`${C.dim}\n${footer}${C.reset}`);
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
    router.ask(goalId);
    const shown = voice.speak(prompt) || prompt;
    say(`${shown}${secret ? `\n${C.dim}(stored only on this computer)${C.reset}` : ""}`);
    ui.prompt();
  },
  onSuggestions(suggestions) {
    ui.showSuggestions(suggestions);
  }
});
