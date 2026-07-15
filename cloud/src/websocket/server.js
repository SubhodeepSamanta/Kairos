import { WebSocketServer } from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { submitGoal } from "../agent/goalManager.js";

const ACTION_TIMEOUT_MS = 60000;
const HUMAN_TIMEOUT_MS = 300000;

let automationClient = null;
const pendingRequests = new Map();
const pendingHumanInputs = new Map();

export function isClientConnected() {
  return automationClient !== null && automationClient.readyState === 1;
}

export async function executeActionRemotely(action) {
  if (!isClientConnected()) {
    throw new Error("no_client_connected");
  }

  const requestId = crypto.randomUUID();
  const timeoutMs = action.type === "store_secret" ? 10000 : ACTION_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`client_timeout after ${timeoutMs / 1000}s on ${action.type}`));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timer });

    const isSecret = action.type === "store_secret" || /\{\{secret:/.test(action.params?.text || "");
    log(`[WS→client] ${action.type}${isSecret ? " (secret redacted)" : " " + JSON.stringify(action.params || {}).slice(0, 120)}`);

    automationClient.send(JSON.stringify({ type: "execute", requestId, action }), (err) => {
      if (err) {
        clearTimeout(timer);
        pendingRequests.delete(requestId);
        reject(new Error("client_disconnected"));
      }
    });
  });
}

function rejectAllPending(reason) {
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error(reason));
  }
  pendingRequests.clear();
}

function askHumanVia(ws, goalId) {
  return (question, { secretName } = {}) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingHumanInputs.delete(goalId);
        reject(new Error("no reply within 5 minutes"));
      }, HUMAN_TIMEOUT_MS);
      pendingHumanInputs.set(goalId, { resolve, reject, timer });
      send(ws, {
        type: "human_input_request",
        goalId,
        prompt: question,
        secret: Boolean(secretName)
      });
    });
}

export function resolveHumanInput(goalId, input) {
  const pending = pendingHumanInputs.get(goalId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingHumanInputs.delete(goalId);
  pending.resolve(String(input ?? ""));
  return true;
}

function send(ws, message) {
  if (ws.readyState === 1) {
    try { ws.send(JSON.stringify(message)); } catch {}
  }
}

export function startWebSocketServer(port = Number(env.PORT) || 8080) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    ws.isAuthed = false;
    ws.role = null;

    ws.on("close", () => {
      if (automationClient === ws) {
        automationClient = null;
        log("Automation client disconnected");
        rejectAllPending("client_disconnected");
      }
    });

    ws.on("error", (error) => log("Socket error:", error.message));

    ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (data.type === "register_client" || data.type === "register_connector") {
        if (env.CLIENT_SECRET && data.secret !== env.CLIENT_SECRET) {
          log(`Rejected ${data.type}: bad secret`);
          send(ws, { type: "auth_failed" });
          ws.close();
          return;
        }
        ws.isAuthed = true;
        if (data.type === "register_client") {
          automationClient = ws;
          ws.role = "client";
          log("Automation client registered");
        } else {
          ws.role = "connector";
          ws.connectorName = data.name || "connector";
          log(`Connector registered: ${ws.connectorName}`);
        }
        send(ws, { type: "registered" });
        return;
      }

      if (!ws.isAuthed) {
        send(ws, { type: "auth_failed" });
        ws.close();
        return;
      }

      if (data.type === "result" && ws.role === "client") {
        const pending = pendingRequests.get(data.requestId);
        if (!pending) {
          log(`[WS] result for unknown requestId ${data.requestId}`);
          return;
        }
        clearTimeout(pending.timer);
        pendingRequests.delete(data.requestId);
        pending.resolve(data.observation || { success: false, reason: "empty observation" });
        return;
      }

      if (data.type === "goal" && ws.role === "connector") {
        const goalId = crypto.randomUUID();
        ws.activeGoalId = goalId;
        submitGoal({
          goal: String(data.goal || ""),
          executeAction: executeActionRemotely,
          askHuman: askHumanVia(ws, goalId),
          onStatus: (status) => send(ws, { type: "goal_status", status }),
          onResult: (success, result) => send(ws, { type: "goal_result", success, result })
        });
        return;
      }

      if (data.type === "human_input_response") {
        const goalId = data.goalId || ws.activeGoalId;
        if (!resolveHumanInput(goalId, data.input)) {
          log(`[WS] human input for unknown goal ${goalId}`);
        }
        return;
      }
    });
  });

  log(`WebSocket listening on ${port}`);
  return wss;
}
