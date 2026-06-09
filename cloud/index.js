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
  !agentResult.success &&
  agentResult.reason ===
    "goal_impossible"
) {

  return `Goal could not be completed.

Reason:
${observation?.action?.params?.text || "requested item"} was not found.`;
}

if (
  observation?.action?.type ===
  "type"
) {

  return `Typed

${observation.actual}`;
}

if (
  observation?.action?.type ===
  "click"
) {

  const text =
    observation.action.params.text;

  if (!observation.success) {

    return `Failed to click: ${text}

Page:
${observation.actual}`;
  }

  return `Clicked: ${text}

Page:
${observation.actual}`;
}
if (agentResult.success) {

  const observation =
    agentResult.observation;

  if (
    observation?.expected ===
    "page_read"
  ) {

    let response =
`Title: ${observation.title || "Unknown"}

URL: ${observation.url || "Unknown"}`;

    if (
      observation.inputs?.length
    ) {

      response +=

`\n\nInputs:

${observation.inputs
  .slice(0, 10)
  .map(input => `- ${input}`)
  .join("\n")}`;
    }

    if (
      observation.buttons?.length
    ) {

      response +=

`\n\nButtons:

${observation.buttons
  .slice(0, 10)
  .map(button => `- ${button}`)
  .join("\n")}`;
    }

    if (
      observation.links?.length
    ) {

      response +=

`\n\nLinks:

${observation.links
  .slice(0, 10)
  .map(link => `- ${link}`)
  .join("\n")}`;
    }

    if (
      observation.text
    ) {

      response +=

`\n\nContent:

${observation.text
  .slice(0, 1000)}`;
    }

    return response;
  }

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