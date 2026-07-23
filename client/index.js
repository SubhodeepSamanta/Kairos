import { env } from "./src/config/env.js";
import { installCrashHandlers } from "./src/utils/crashLog.js";
import { clientPreflight, reportPreflight } from "./src/config/preflight.js";
import { connectToCloud } from "./src/websocket/client.js";
import { closeBrowser } from "./src/automation/browser/browser.js";
import { launchConsole } from "./src/connectors/cli/launcher.js";
import readline from "readline";

installCrashHandlers();
reportPreflight(clientPreflight());

console.log("Commands:\n  startKairos\n  voice\n  exit\n");

connectToCloud(env.CLOUD_URL || "ws://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function startConsole({ voice = false } = {}) {
  const result = launchConsole({ voice });
  if (result.opened) {
    console.log(voice
      ? "Kairos opened in its own window with voice on — this terminal stays for logs."
      : "Kairos opened in its own window — this terminal stays for logs.");
    askCommand();
    return;
  }
  if (result.reason === "already-open") {
    console.log(voice
      ? 'The Kairos window is already open — type "voice" there.'
      : "The Kairos window is already open — use that one.");
    askCommand();
    return;
  }
  rl.close();
  if (voice) process.env.VOICE = "1";
  import("./src/connectors/cli/index.js").catch((err) => {
    console.error(`Could not start the console: ${err.message}`);
    process.exit(1);
  });
}

function askCommand() {
  rl.question("", (input) => {
    const cmd = input.trim();
    const normalized = cmd.toLowerCase().replace(/\s+/g, "");

    if (normalized === "startkairos" || normalized === "kairos" || normalized === "start") {
      startConsole();
      return;
    }
    if (["voice", "kairosvoice", "stt", "tts", "enablevoice", "voiceon"].includes(normalized)) {
      startConsole({ voice: true });
      return;
    }
    if (normalized === "exit" || normalized === "close") {
      shutdown();
      return;
    }
    console.log("Unknown command. Available: startKairos, voice, exit");
    askCommand();
  });
}

function shutdown() {
  console.log("Closing the automation browser…");
  const bail = setTimeout(() => process.exit(0), 5000);
  closeBrowser().finally(() => {
    clearTimeout(bail);
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
rl.on("SIGINT", shutdown);

askCommand();