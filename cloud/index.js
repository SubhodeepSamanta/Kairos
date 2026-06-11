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
console.log(
  "MEMORY:",
  memory
);
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
  observation?.action?.type ===
  "press_key"
) {

  if (
    observation.after?.url &&
    observation.after?.title
  ) {

    return `Search completed

Title:
${observation.after.title}

URL:
${observation.after.url}`;
  }

  return `Pressed ${observation.key}`;
}
if (
  observation?.action?.type ===
  "extract_metadata"
) {

  const meta =
    observation.metadata;

  return `
Title:
${meta.title}

Description:
${meta.description || "None"}

Keywords:
${meta.keywords || "None"}

Author:
${meta.author || "Unknown"}
`;
}
if (
  observation?.action?.type ===
  "screenshot"
) {

  return `Screenshot saved:

${observation.path}`;
}
if (
  observation?.action?.type ===
  "extract_links"
) {

  const links =
    observation.links || [];

  if (
    links.length === 0
  ) {
    return "No links found.";
  }

  let response =
    "Links:\n\n";

  for (
    const link of links.slice(0, 20)
  ) {

    response +=
      `${link.text}\n`;

    response +=
      `${link.href}\n\n`;
  }

  return response;
}
if (
  observation?.action?.type ===
  "scroll"
) {

  return `Scrolled ${observation.direction}`;
}
if (
  observation?.action?.type ===
  "wait"
) {

  return `Waited ${observation.seconds} seconds`;
}
if (
  observation?.action?.type ===
  "close_tab"
) {

  return `Closed tab ${observation.index}`;
}
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

if (agentResult.success) {

  const observation =
    agentResult.observation;
if (
  observation?.action?.type ===
  "list_tabs"
  
) {
console.log(
  "TAB OBSERVATION:",
  JSON.stringify(
    observation,
    null,
    2
  )
);
  const tabs =
    observation.tabs || [];

  if (
    tabs.length === 0
  ) {
    return "No tabs open.";
  }

  let response =
    "Open Tabs:\n\n";

  for (
  const tab of tabs
) {

  response +=
    `${tab.active ? "→" : " "} Tab ${tab.index}\n`;

  response +=
    `${tab.title}\n`;

  response +=
    `${tab.url}\n\n`;
}

  return response;
}
if (
  observation?.action?.type ===
  "switch_tab"
) {

  return `Switched to tab ${observation.index}`;
}

if (
  observation?.action?.type ===
  "new_tab"
) {

  return `Created tab ${observation.index}`;
}
if (
  observation?.action?.type ===
  "click"
) {

  return `Clicked: ${
    observation.clicked ||
    "unknown"
  }

Page:
${
    observation.actual
  }`;
}
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
  .map(input =>
    `- [${input.id}] ${input.text}`
  )
  .join("\n")}`;
    }

    if (
      observation.buttons?.length
    ) {

      response +=

`\n\nButtons:

${observation.buttons
  .slice(0, 10)
  .map(button =>
    `- [${button.id}] ${button.text}`
  )
  .join("\n")}`;
    }

    if (
      observation.links?.length
    ) {

      response +=

`\n\nLinks:

${observation.links
  .slice(0, 10)
  .map(link =>
    `- [${link.id}] ${link.text}`
  )
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

if (
  response.length > 3500
) {

  response =
    response.slice(
      0,
      3500
    ) +
    "\n\n[truncated]";
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