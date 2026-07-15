import WebSocket from "ws";

let socket = null;
let onResultCallback = null;
let onStatusCallback = null;

export function connectToCloud(url, onResult, onStatus) {
  socket = new WebSocket(url);
  onResultCallback = onResult;
  onStatusCallback = onStatus;

  socket.on("open", () => {
    socket.send(JSON.stringify({ type: "register_connector", name: "cli" }));
  });

  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "goal_result") {
        if (onResultCallback) onResultCallback(message.result, message.success);
      } else if (message.type === "goal_status") {
        if (onStatusCallback) onStatusCallback(message.status);
      }
    } catch (e) {
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
