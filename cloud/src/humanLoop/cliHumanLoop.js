import readline from "readline";
import humanLoopBus from "./humanLoopBus.js";

export function initCliHumanLoop() {
  // Subscribe to intervention needed events
  humanLoopBus.on("intervention_needed", ({ goalId, reason, pageUrl }) => {
    console.log(`\n==================================================`);
    console.log(`[HUMAN NEEDED] GoalId: ${goalId}`);
    console.log(`Reason: ${reason}`);
    console.log(`URL: ${pageUrl}`);
    console.log(`Type 'resume ${goalId}' or 'cancel ${goalId}' to continue`);
    console.log(`==================================================\n`);
  });

  humanLoopBus.on("intervention_resolved", ({ goalId }) => {
    console.log(`[HUMAN LOOP] Intervention resolved for goal: ${goalId}`);
  });

  humanLoopBus.on("intervention_cancelled", ({ goalId }) => {
    console.log(`[HUMAN LOOP] Intervention cancelled for goal: ${goalId}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("line", async (line) => {
    const input = line.trim();
    if (input.startsWith("resume ")) {
      const goalId = input.substring(7).trim();
      console.log(`[CLI LOOP] Attempting resume for: ${goalId}`);
      await humanLoopBus.resume(goalId);
    } else if (input.startsWith("cancel ")) {
      const goalId = input.substring(7).trim();
      console.log(`[CLI LOOP] Attempting cancel for: ${goalId}`);
      humanLoopBus.cancel(goalId);
    }
  });

  console.log("[CLI HUMAN LOOP] Active and listening for human intervention requests.");
}
