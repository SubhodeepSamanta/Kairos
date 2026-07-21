import { env } from "./src/config/env.js";
import { clientPreflight, reportPreflight } from "./src/config/preflight.js";
import { connectToCloud } from "./src/websocket/client.js";
import { launchKairosConsole } from "./src/connectors/cli/launcher.js";
import { closeBrowser } from "./src/automation/browser/browser.js";
import readline from "readline";

reportPreflight(clientPreflight());

console.log("Commands:\n  startKairos\n  voice\n  exit\n");

connectToCloud(env.CLOUD_URL || "ws://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askCommand() {
  rl.question("", (input) => {
    const cmd = input.trim();
    const normalized = cmd.toLowerCase().replace(/\s+/g, "");
    
    if (normalized === "startkairos" || normalized === "kairos" || normalized === "start") {
      console.log("Launching Kairos Console...");
      launchKairosConsole();
    } else if (normalized === "voice" || normalized === "kairosvoice" || normalized === "stt" || normalized === "tts") {
      console.log("Launching Kairos Console with voice…");
      launchKairosConsole({ voice: true });
    } else if (normalized === "exit" || normalized === "close") {
      shutdown();
    } else {
      console.log("Unknown command. Available: startKairos, voice, exit");
    }
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