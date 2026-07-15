import WebSocket from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { executeAction } from "../executor/executor.js";

const RECONNECT_DELAY_MS = 3000;

let socket = null;

export function connectToCloud(url) {
  function connect() {
    log(`Connecting to ${url}...`);
    socket = new WebSocket(url);

    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "register_client", secret: env.CLIENT_SECRET }));
    });

    socket.on("close", () => {
      log("Disconnected from cloud, retrying in 3s");
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    socket.on("error", (error) => {
      log("Socket error:", error.message);
    });

    socket.on("message", async (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (data.type === "registered") {
        log("Registered with cloud");
        return;
      }

      if (data.type === "auth_failed") {
        log("Cloud rejected our CLIENT_SECRET. Check that client/.env and cloud/.env match.");
        return;
      }

      if (data.type === "execute") {
        let observation;
        try {
          observation = await executeAction(data.action);
        } catch (err) {
          observation = { success: false, reason: err.message };
        }
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "result", requestId: data.requestId, observation }));
        }
        return;
      }
    });
  }

  connect();
  return socket;
}

export function getSocket() {
  return socket;
}
