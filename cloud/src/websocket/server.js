import { WebSocketServer } from "ws";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { submitGoal, cancelGoals } from "../agent/goalManager.js";
import { commandSuggestions } from "../companion/commands.js";
import { IDENTITY, getPrefs } from "../companion/store.js";
import { getPersona } from "../companion/personas.js";

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
      pendingHumanInputs.set(goalId, { resolve, reject, timer, ws });
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

function dropConnector(ws) {
  let orphaned = 0;
  for (const [goalId, pending] of pendingHumanInputs) {
    if (pending.ws !== ws) continue;
    clearTimeout(pending.timer);
    pendingHumanInputs.delete(goalId);
    pending.reject(new Error("they closed the console before answering"));
    orphaned++;
  }
  if (orphaned === 0) return;
  const { wasRunning } = cancelGoals();
  log(`Connector ${ws.connectorName || "?"} left with ${orphaned} question(s) unanswered — running:${wasRunning}`);
}

function send(ws, message) {
  if (ws.readyState === 1) {
    try { ws.send(JSON.stringify(message)); } catch {}
  }
}

async function sendPersona(ws) {
  try {
    const { persona } = await getPrefs(IDENTITY);
    const p = getPersona(persona);
    if (ws.personaId === p.id) return;
    ws.personaId = p.id;
    send(ws, { type: "persona", persona: { id: p.id, name: p.name, pronouns: p.pronouns, voice: p.voice } });
  } catch {}
}

export function startWebSocketServer(port = Number(env.PORT) || 3000) {
  const wss = new WebSocketServer({ port });

  wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`\n✗ Port ${port} is already in use — is another Kairos cloud running?`);
      console.log(`  Stop it, or set a different PORT in cloud/.env (and match it in client CLOUD_URL).\n`);
      process.exit(1);
    }
    log("WebSocket server error:", err.message);
  });

  wss.on("connection", (ws) => {
    ws.isAuthed = false;
    ws.role = null;

    ws.on("close", () => {
      if (automationClient === ws) {
        automationClient = null;
        log("Automation client disconnected");
        rejectAllPending("client_disconnected");
      }
      if (ws.role === "connector") dropConnector(ws);
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
        if (ws.role === "connector") sendPersona(ws);
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

      if (data.type === "cancel" && ws.role === "connector") {
        const { wasRunning, dropped } = cancelGoals();
        log(`Cancel requested — running:${wasRunning} queued:${dropped}`);
        if (!wasRunning) {
          send(ws, { type: "goal_result", success: true, result: dropped ? "dropped what was waiting." : "nothing was running." });
        }
        return;
      }

      if (data.type === "voice_mode" && ws.role === "connector") {
        ws.voiceMode = Boolean(data.on);
        log(`Voice mode ${ws.voiceMode ? "on" : "off"} for ${ws.connectorName}`);
        return;
      }

      if (data.type === "suggest" && ws.role === "connector") {
        send(ws, { type: "suggestions", suggestions: commandSuggestions(data.text || "") });
        return;
      }

      if (data.type === "goal" && ws.role === "connector") {
        const goalId = crypto.randomUUID();
        ws.activeGoalId = goalId;
        submitGoal({
          goal: String(data.goal || ""),
          tone: data.tone ? String(data.tone).slice(0, 120) : null,
          chatId: IDENTITY,
          executeAction: executeActionRemotely,
          askHuman: askHumanVia(ws, goalId),
          voiceMode: Boolean(ws.voiceMode),
          onStatus: (status) => send(ws, { type: "goal_status", status }),
          onResult: (success, result) => {
            send(ws, { type: "goal_result", success, result });
            sendPersona(ws);
          }
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
