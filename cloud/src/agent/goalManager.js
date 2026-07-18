import { runAgent } from "./loop/agentLoop.js";
import { isCommand, runCommand } from "../companion/commands.js";

const queue = [];
let running = false;

export function pendingGoals() {
  return queue.length + (running ? 1 : 0);
}

export function submitGoal({ goal, chatId = "default", executeAction, askHuman, onStatus, onResult }) {
  if (isCommand(goal)) {
    runCommand(chatId, goal)
      .then(reply => onResult(true, reply))
      .catch(err => onResult(false, `command failed: ${err.message}`));
    return;
  }

  queue.push({ goal, chatId, executeAction, askHuman, onStatus, onResult });
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
  console.log(`\n[GOAL ${goalId.slice(0, 8)}] ${item.goal}`);

  try {
    const result = await runAgent({
      goal: item.goal,
      goalId,
      chatId: item.chatId,
      executeAction: item.executeAction,
      askHuman: item.askHuman,
      onStatus: item.onStatus
    });
    try { item.onResult(result.success, result.answer); } catch {}
  } catch (err) {
    console.error(`[GOAL ${goalId.slice(0, 8)}] crashed:`, err);
    try { item.onResult(false, `something broke: ${err.message}`); } catch {}
  } finally {
    running = false;
    processQueue();
  }
}
