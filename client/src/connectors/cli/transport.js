import WebSocket from "ws";
import { env } from "../../config/env.js";

const RETRY_WAITS_MS = [1000, 2000, 4000, 8000, 15000, 30000];

let socket = null;
let handlers = {};
let cloudUrl = null;
let attempt = 0;
let retryTimer = null;
let closing = false;
let everConnected = false;

function scheduleRetry() {
  if (closing || retryTimer) return;
  const wait = RETRY_WAITS_MS[Math.min(attempt, RETRY_WAITS_MS.length - 1)];
  attempt++;
  handlers.onLink?.(`lost the cloud — reconnecting in ${Math.round(wait / 1000)}s`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    open();
  }, wait);
}

function open() {
  if (closing) return;
  socket = new WebSocket(cloudUrl);

  socket.on("open", () => {
    attempt = 0;
    socket.send(JSON.stringify({ type: "register_connector", name: "cli", secret: env.CLIENT_SECRET }));
  });

  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (message.type === "registered") {
      if (everConnected) handlers.onLink?.("back online");
      everConnected = true;
      handlers.onReady?.();
    }
    else if (message.type === "goal_result") handlers.onResult?.(message.result, message.success, message.spoken);
    else if (message.type === "persona") handlers.onPersona?.(message.persona);
    else if (message.type === "goal_status") handlers.onStatus?.(message.status);
    else if (message.type === "suggestions") handlers.onSuggestions?.(message.suggestions);
    else if (message.type === "human_input_request") handlers.onAsk?.(message.prompt, message.goalId, message.secret);
    else if (message.type === "auth_failed") {
      closing = true;
      console.log("\nCloud rejected CLIENT_SECRET. Check client/.env matches cloud/.env.");
      process.exit(1);
    }
  });

  socket.on("error", (err) => {
    if (!everConnected && attempt === 0) {
      handlers.onLink?.(`cannot reach the cloud (${err.message}) — retrying`);
    }
  });

  socket.on("close", () => {
    socket = null;
    scheduleRetry();
  });
}

export function connectToCloud(url, newHandlers) {
  handlers = newHandlers || {};
  cloudUrl = url;
  closing = false;
  open();
}

export function isLinked() {
  return Boolean(socket && socket.readyState === WebSocket.OPEN);
}

export function disconnectFromCloud() {
  closing = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  try { socket?.close(); } catch {}
  socket = null;
}

function send(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

export function sendGoal(goal, tone) {
  if (!send({ type: "goal", goal, tone: tone || undefined })) {
    handlers.onLink?.("not connected to the cloud yet — try again in a moment");
  }
}

export function sendHumanReply(goalId, input) {
  send({ type: "human_input_response", goalId, input });
}

export function requestSuggestions(text) {
  send({ type: "suggest", text });
}

export function sendCancel() {
  return send({ type: "cancel" });
}

export function sendVoiceMode(on) {
  send({ type: "voice_mode", on: Boolean(on) });
}
