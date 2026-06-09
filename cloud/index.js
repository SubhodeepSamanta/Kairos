import { env } from "./src/config/env.js";

import { connectDatabase } from "./src/database/connection.js";
import { createMemoryTables } from "./src/memory/schema.js";

import { createGoal } from "./src/shared/schemas/goal.js";

import { routeMessage } from "./src/router/router.js";
import { chatReply } from "./src/chat/chat.js";

import {
    startWebSocketServer,
    executePlanRemotely
} from "./src/websocket/server.js";

import {
    startTelegramBot
} from "./src/connectors/telegram/telegram.js";

import { extractMemory } from "./src/memory/extract.js";
import { storeMemory } from "./src/memory/store.js";
import { retrieveMemory } from "./src/memory/retrieve.js";
import { runAgent } from "./src/planner/agent.js";

await connectDatabase();
await createMemoryTables();

startWebSocketServer();

startTelegramBot(
    env.TELEGRAM_BOT_TOKEN,

    async (message) => {

        const route = routeMessage(message);
        const memory =
            await extractMemory(message);

        const memoryResponse =
            await storeMemory(memory);

        if (memoryResponse) {
            return memoryResponse;
        }
        const retrieved =
            await retrieveMemory(
                message
            );
        if (retrieved) {
            return retrieved;
        }

        if (route.type === "chat") {
            return chatReply(message);
        }

        if (route.type === "research") {

            const {
                runResearch
            } = await import(
                "./src/research/research.js"
            );

            return runResearch(message);
        }

        const goal = createGoal(message);

let agentResult;

try {

  try {

  agentResult =
    await runAgent({
      goal,
      executePlan:
        executePlanRemotely
    });

} catch (error) {

  console.error(
    "RUN AGENT ERROR:",
    error
  );

  throw error;
}

} catch {

  return "No device is connected. Automation tasks require the Kairos client to be running.";
}

const observation =
  agentResult.observation;

if (
  observation?.action?.type === "read_ui"
) {

  return `Title: ${observation.actual}

URL: ${observation.url}

${observation.text || "No content found"}`;
}

if (agentResult.success) {

  return `Success

Action: ${message}
Result: ${
    observation?.actual ||
    "completed"
  }`;
}

return `Failed

Action: ${message}
Reason: ${
  observation?.reason ||
  agentResult.reason ||
  "unknown"
}`;
    }
);