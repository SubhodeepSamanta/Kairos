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
    if (message.type === "registered" && handlers.onReady) handlers.onReady();
    else if (message.type === "goal_result" && handlers.onResult) handlers.onResult(message.result, message.success, message.spoken);
    else if (message.type === "persona" && handlers.onPersona) handlers.onPersona(message.persona);
    else if (message.type === "goal_status" && handlers.onStatus) handlers.onStatus(message.status);
    else if (message.type === "suggestions" && handlers.onSuggestions) handlers.onSuggestions(message.suggestions);
    else if (message.type === "human_input_request" && handlers.onAsk) handlers.onAsk(message.prompt, message.goalId, message.secret);
    else if (message.type === "auth_failed") {
      console.log("\nCloud rejected CLIENT_SECRET. Check client/.env matches cloud/.env.");
      process.exit(1);
    }
  });

  socket.on("error", (err) => {
    console.log(`\nCannot reach Kairos cloud: ${err.message}`);
    process.exit(1);
  });

  socket.on("close", () => {
    console.log("\nDisconnected from Kairos cloud.");
    process.exit(0);
  });
}

function send(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

export function sendGoal(goal) {
  if (!send({ type: "goal", goal })) console.log("\nNot connected to cloud.");
}

export function sendHumanReply(goalId, input) {
  send({ type: "human_input_response", goalId, input });
}

export function requestSuggestions(text) {
  send({ type: "suggest", text });
}
