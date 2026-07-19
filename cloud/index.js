import { env } from "./src/config/env.js";
import { cloudPreflight, reportPreflight } from "./src/config/preflight.js";
import { initMemory } from "./src/memory/store.js";
import { memoryPool } from "./src/memory/db.js";
import { flushDbWrites, pendingDbWrites } from "./src/memory/syncQueue.js";
import { startWebSocketServer } from "./src/websocket/server.js";
import { startTelegramBot } from "./src/connectors/telegram/telegram.js";

if (!reportPreflight(cloudPreflight())) {
  process.exit(1);
}

await initMemory();
startWebSocketServer();
startTelegramBot(env.TELEGRAM_BOT_TOKEN);

process.on("SIGINT", async () => {
  if (pendingDbWrites()) {
    console.log(`\nFlushing ${pendingDbWrites()} queued database write(s)…`);
    await flushDbWrites(memoryPool()).catch(() => {});
  }
  process.exit(0);
});

console.log("Kairos cloud is running.");
