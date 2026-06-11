import { WebSocketServer } from "ws";
import { log } from "../utils/logger.js";
import {
  getAgentState,
  setBrowserState
} from "../agent/state.js";

let connectedClient = null;
let pendingResolve = null;

export function startWebSocketServer(
  port = 8080
) {

  const wss =
    new WebSocketServer({
      port
    });

  wss.on(
    "connection",
    (ws) => {

      connectedClient = ws;

      log(
        "Client connected"
      );

      ws.on(
        "close",
        () => {

          log(
            "Client disconnected"
          );

          if (
            connectedClient === ws
          ) {
            connectedClient =
              null;
          }
        }
      );

      ws.on(
        "error",
        (error) => {

          log(
            "Client socket error:",
            error.message
          );
        }
      );

      ws.on(
        "message",
        (message) => {

          const data =
            JSON.parse(
              message.toString()
            );
console.log(
  "LATEST OBS:",
  data.observations?.[
    data.observations.length - 1
  ]?.expected
);
          if (
            data.type ===
              "execution_result" &&
            pendingResolve
          ) {
            const latestObservation =
  data.observations?.[
    data.observations.length - 1
  ];

const pageState =
  latestObservation?.pageState;

if (pageState) {

  console.log(
    "UPDATING BROWSER STATE:",
    pageState.title
  );

  setBrowserState(
    pageState
  );
}
console.log(
  "STATE AFTER UPDATE:",
  JSON.stringify(
    getAgentState(),
    null,
    2
  )
);
            pendingResolve(
              data
            );

            pendingResolve =
              null;
          }

          log(
            "Received:",
            JSON.stringify(
              data,
              null,
              2
            )
          );
        }
      );
    }
  );

  log(
    `WebSocket listening on ${port}`
  );

  return wss;
}

export async function executePlanRemotely(
  plan
) {

  if (
    !connectedClient ||
    connectedClient.readyState !== 1
  ) {

    throw new Error(
      "No connected client"
    );
  }

  console.log(
    "\n===== SENDING PLAN ====="
  );

  console.log(
    JSON.stringify(
      plan,
      null,
      2
    )
  );

  return new Promise(
    (resolve) => {

      pendingResolve =
        resolve;

      connectedClient.send(
        JSON.stringify({
          type:
            "execute_plan",
          plan
        })
      );
    }
  );
}