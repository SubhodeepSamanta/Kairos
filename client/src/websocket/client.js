import WebSocket from "ws";
import { log } from "../utils/logger.js";
import { executePlan } from "../executor/executor.js";
import { observeAction } from "../observer/observer.js";

let socket = null;

export function connectToCloud(url) {

  function connect() {

    log(`Connecting to ${url}...`);

    socket = new WebSocket(url);

    socket.on("open", () => {
      log("Connected to cloud");
    });

    socket.on("close", () => {

      log("Disconnected from cloud");

      setTimeout(() => {
        connect();
      }, 3000);
    });

    socket.on("error", (error) => {

      log(
        "Socket error:",
        error.message
      );

    });

    socket.on("message", async (message) => {

      const data = JSON.parse(
        message.toString()
      );

      if (
        data.type !==
        "execute_plan"
      ) {
        return;
      }

      log("Executing plan");

      const plan = data.plan;

      const results =
        await executePlan(plan);

      const observations = [];

for (
  let i = 0;
  i < plan.actions.length;
  i++
) {

  const obs =
    await observeAction(
      plan.actions[i],
      results[i]
    );

  console.log(
    "OBS CREATED:",
    JSON.stringify(
      obs,
      null,
      2
    )
  );

  observations.push(obs);
}

      socket.send(
        JSON.stringify({
          type:
            "execution_result",
          observations
        })
      );
    });
  }

  connect();

  return socket;
}

export function getSocket() {
  return socket;
}