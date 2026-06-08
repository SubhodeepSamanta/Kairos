import { env } from "./src/config/env.js";

import { createGoal } from "./src/shared/schemas/goal.js";
import { createGoalPlan } from "./src/planner/planner.js";

import { routeMessage } from "./src/router/router.js";
import { chatReply } from "./src/chat/chat.js";

import {
    startWebSocketServer,
    executePlanRemotely
} from "./src/websocket/server.js";

import {
    startTelegramBot
} from "./src/connectors/telegram/telegram.js";

startWebSocketServer();

startTelegramBot(
    env.TELEGRAM_BOT_TOKEN,

    async (message) => {

        const route =
            routeMessage(message);
            console.log("MESSAGE:", message);
console.log("ROUTE:", route);

        if (route.type === "chat") {
            return chatReply(message);
        }

        if (route.type === "research") {

            const {
                runResearch
            } = await import(
                "./src/research/research.js"
            );

            return runResearch(
                message
            );
        }

        const goal =
            createGoal(message);

        const plan =
            await createGoalPlan(goal);

        if (
            plan.actions.length === 0
        ) {
            return "I don't know how to do that yet.";
        }

        let result;

        try {

            result =
                await executePlanRemotely(
                    plan
                );

        }

        catch {

            return `
No device is connected.

Automation tasks require the Kairos client to be running.
`;
        }
        const observation =
            result.observations?.[0];

        if (
            observation?.success
        ) {
            return `Completed: ${message}`;
        }

        return `Failed: ${message}`;
    }
);