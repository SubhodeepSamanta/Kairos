import WebSocket from "ws";
import { env } from "../../config/env.js";

let socket = null;
let handlers = {};

export function connectToCloud(url, newHandlers) {
  handlers = newHandlers;
  socket = new WebSocket(url);

  socket.on("open", () => {
    socket.send(JSON.stringify({ type: "register_connector", name: "cli", secret: env.CLIENT_SECRET }));
  });

  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (message.type === "goal_result" && handlers.onResult) {
      handlers.onResult(message.result, message.success);
    } else if (message.type === "goal_status" && handlers.onStatus) {
      handlers.onStatus(message.status);
    } else if (message.type === "human_input_request" && handlers.onAsk) {
      handlers.onAsk(message.prompt, message.goalId, message.secret);
    } else if (message.type === "auth_failed") {
      console.log("\nCloud rejected CLIENT_SECRET. Check client/.env matches cloud/.env.");
      process.exit(1);
    }
  });

  socket.on("close", () => {
    console.log("\nDisconnected from Kairos Cloud. Exiting...");
    process.exit(0);
  });
}

export function sendGoal(goal) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "goal", goal }));
  } else {
    console.log("\nError: Not connected to cloud.");
  }
}

export function sendHumanReply(goalId, input) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "human_input_response", goalId, input }));
  }
}
