import WebSocket from "ws";
import { log } from "../utils/logger.js";
import { executePlan } from "../executor/executor.js";
import { observeAction } from "../observer/observer.js";

let socket = null;

export function connectToCloud(url) {
  socket = new WebSocket(url);

  socket.on("open", () => {
    log("Connected to cloud");
  });

  socket.on("close", () => {
    log("Disconnected from cloud");
  });

  socket.on("message", async (message) => {
    const data = JSON.parse(
      message.toString()
    );

    if (data.type !== "execute_plan") {
      return;
    }

    log("Executing plan");

    await executePlan(data.plan);

    const observations = [];

    for (const action of data.plan.actions) {
      const observation =
        await observeAction(action);

      observations.push(
        observation
      );
    }

    socket.send(
      JSON.stringify({
        type: "execution_result",
        observations
      })
    );
  });

  return socket;
}

export function getSocket() {
  return socket;
}