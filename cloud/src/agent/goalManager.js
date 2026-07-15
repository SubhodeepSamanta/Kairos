import { runAgent } from "./loop/agentLoop.js";

const queue = [];
let running = false;

export function pendingGoals() {
  return queue.length + (running ? 1 : 0);
}

export function submitGoal({ goal, executeAction, askHuman, onStatus, onResult }) {
  queue.push({ goal, executeAction, askHuman, onStatus, onResult });
  if (queue.length > 1 || running) {
    try { onStatus(`Queued (position ${queue.length}${running ? ", one goal running" : ""})`); } catch {}
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
      executeAction: item.executeAction,
      askHuman: item.askHuman,
      onStatus: item.onStatus
    });
    try { item.onResult(result.success, result.answer); } catch {}
  } catch (err) {
    console.error(`[GOAL ${goalId.slice(0, 8)}] crashed:`, err);
    try { item.onResult(false, `Something went wrong: ${err.message}`); } catch {}
  } finally {
    running = false;
    processQueue();
  }
}
