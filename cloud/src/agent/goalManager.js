import { runAgent } from "./loop/agentLoop.js";
import { isCommand, runCommand } from "../companion/commands.js";
import { markQueueDepth } from "../runtime.js";

const queue = [];
let running = false;
let active = null;

export function pendingGoals() {
  return queue.length + (running ? 1 : 0);
}

export function cancelGoals() {
  const waiting = queue.splice(0, queue.length);
  const wasRunning = Boolean(active);
  if (active) active.cancelled = true;
  for (const item of waiting) {
    try { item.onResult(false, "okay — dropped that one before it started."); } catch {}
  }
  return { wasRunning, dropped: waiting.length };
}

export function submitGoal({ goal, tone = null, chatId = "default", executeAction, askHuman, onStatus, onResult, voiceMode = false }) {
  if (isCommand(goal)) {
    runCommand(chatId, goal)
      .then(reply => onResult(true, reply))
      .catch(err => onResult(false, `command failed: ${err.message}`));
    return;
  }

  queue.push({ goal, tone, chatId, executeAction, askHuman, onStatus, onResult, voiceMode });
  const ahead = queue.length - 1 + (running ? 1 : 0);
  if (ahead > 0) {
    try { onStatus(`queued (${ahead} ahead)`); } catch {}
  }
  processQueue();
}

async function processQueue() {
  if (running) return;
  const item = queue.shift();
  if (!item) return;
  running = true;

  const goalId = crypto.randomUUID();
  active = { goalId, cancelled: false };
  markQueueDepth(queue.length);
  console.log(`\n[GOAL ${goalId.slice(0, 8)}] ${item.goal}`);

  try {
    const result = await runAgent({
      goal: item.goal,
      tone: item.tone,
      goalId,
      chatId: item.chatId,
      executeAction: item.executeAction,
      askHuman: item.askHuman,
      onStatus: item.onStatus,
      voiceMode: item.voiceMode,
      isCancelled: () => Boolean(active?.cancelled)
    });
    try { item.onResult(result.success, result.answer); } catch {}
  } catch (err) {
    console.error(`[GOAL ${goalId.slice(0, 8)}] crashed:`, err);
    try { item.onResult(false, `something broke: ${err.message}`); } catch {}
  } finally {
    active = null;
    running = false;
    markQueueDepth(queue.length);
    processQueue();
  }
}
