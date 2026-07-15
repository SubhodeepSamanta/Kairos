import { env } from "./src/config/env.js";
import { initMemory } from "./src/memory/store.js";
import { startWebSocketServer } from "./src/websocket/server.js";
import { startTelegramBot } from "./src/connectors/telegram/telegram.js";

await initMemory();
startWebSocketServer();
startTelegramBot(env.TELEGRAM_BOT_TOKEN);

console.log("Kairos cloud is running.");
