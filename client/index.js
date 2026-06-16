import { connectToCloud } from "./src/websocket/client.js";
import { launchKairosConsole } from "./src/connectors/cli/launcher.js";
import readline from "readline";

console.log("Client Connected");
console.log("Browser Connected");
console.log("Cloud Connected\n");
console.log("Commands:\n  startKairos\n  exit\n");

connectToCloud("ws://localhost:8080");

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
    } else if (normalized === "exit"|| normalized === "close") {
      process.exit(0);
    } else {
      console.log("Unknown command. Available: startKairos, exit");
    }
    askCommand();
  });
}

askCommand();