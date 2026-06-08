import { env } from "./src/config/env.js";

import { createGoal }
from "./src/shared/schemas/goal.js";

import { createGoalPlan }
from "./src/planner/planner.js";

import {
  startWebSocketServer,
  executePlanRemotely
}
from "./src/websocket/server.js";

import {
  startTelegramBot
}
from "./src/connectors/telegram/telegram.js";

startWebSocketServer();

startTelegramBot(
  env.TELEGRAM_BOT_TOKEN,

  async (message) => {

    const goal =
      createGoal(message);

    const plan =
      await createGoalPlan(
        goal
      );

    const result =
      await executePlanRemotely(
        plan
      );

    const observation =
      result.observations?.[0];

    if (
      observation?.success
    ) {
      return "Task completed";
    }

    return "Task failed";
  }
);