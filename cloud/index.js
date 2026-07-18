import { env } from "./src/config/env.js";
import { cloudPreflight, reportPreflight } from "./src/config/preflight.js";
import { initMemory } from "./src/memory/store.js";
import { startWebSocketServer } from "./src/websocket/server.js";
import { startTelegramBot } from "./src/connectors/telegram/telegram.js";

if (!reportPreflight(cloudPreflight())) {
  process.exit(1);
}

await initMemory();
startWebSocketServer();
startTelegramBot(env.TELEGRAM_BOT_TOKEN);

console.log("Kairos cloud is running.");
