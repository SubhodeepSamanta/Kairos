import { env } from "./src/config/env.js";
import { installCrashHandlers } from "./src/utils/crashLog.js";
import { cloudPreflight, reportPreflight } from "./src/config/preflight.js";
import { initMemory } from "./src/memory/store.js";
import { hydrateCompanionFromDb } from "./src/companion/hydrate.js";
import { unifyIdentity } from "./src/companion/store.js";
import { memoryPool } from "./src/memory/db.js";
import { flushDbWrites, pendingDbWrites } from "./src/memory/syncQueue.js";
import { sweepStaleTemps } from "./src/utils/jsonFile.js";
import path from "path";
import { startWebSocketServer, runScheduledGoal } from "./src/websocket/server.js";
import { startTelegramBot } from "./src/connectors/telegram/telegram.js";
import { startScheduler } from "./src/schedule/scheduler.js";
import { detectLocation, describeLocation } from "./src/agent/location.js";

installCrashHandlers();

if (!reportPreflight(cloudPreflight())) {
  process.exit(1);
}

const swept = sweepStaleTemps(path.join(process.cwd(), "data"));
if (swept) console.log(`[STORE] cleaned ${swept} stale temp file${swept === 1 ? "" : "s"}`);

startWebSocketServer();
startTelegramBot(env.TELEGRAM_BOT_TOKEN);
startScheduler(runScheduledGoal);

initMemory()
  .then(() => hydrateCompanionFromDb())
  .then(() => unifyIdentity())
  .then(() => console.log("[BOOT] memory sync finished"))
  .catch((err) => console.log(`[BOOT] memory sync failed (${err.message.slice(0, 80)}) — running on local files`));

detectLocation()
  .then((loc) => { const p = describeLocation(loc); if (p) console.log(`[BOOT] location: ${p}`); })
  .catch(() => {});

process.on("SIGINT", async () => {
  if (pendingDbWrites()) {
    console.log(`\nFlushing ${pendingDbWrites()} queued database write(s)…`);
    await flushDbWrites(memoryPool()).catch(() => {});
  }
  process.exit(0);
});

console.log("Kairos cloud is running.");
