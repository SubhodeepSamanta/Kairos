import readline from "readline";
import humanLoopBus from "./humanLoopBus.js";

export function initCliHumanLoop() {
  humanLoopBus.on("input_requested", ({ goalId, prompt, responseType, context }) => {
    console.log(`\n==================================================`);
    console.log(`[HUMAN NEEDED] GoalId: ${goalId}`);
    console.log(`Reason: ${prompt}`);
    console.log(`Response type: ${responseType}`);
    if (context?.url) console.log(`URL: ${context.url}`);
    if (context?.title) console.log(`Title: ${context.title}`);
    console.log(`Type your response below:`);
    console.log(`==================================================\n`);
  });

  humanLoopBus.on("input_received", ({ goalId, input }) => {
    console.log(`[HUMAN LOOP] Input received for goal: ${goalId}`);
  });

  humanLoopBus.on("input_cancelled", ({ goalId }) => {
    console.log(`[HUMAN LOOP] Input cancelled for goal: ${goalId}`);
  });

  humanLoopBus.on("intervention_resolved", ({ goalId }) => {
    console.log(`[HUMAN LOOP] Intervention resolved for goal: ${goalId}`);
  });

  humanLoopBus.on("intervention_cancelled", ({ goalId }) => {
    console.log(`[HUMAN LOOP] Intervention cancelled for goal: ${goalId}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
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
    } else if (input.startsWith("respond ")) {
      const rest = input.substring(8).trim();
      const spaceIdx = rest.indexOf(" ");
      if (spaceIdx > 0) {
        const goalId = rest.substring(0, spaceIdx).trim();
        const response = rest.substring(spaceIdx + 1).trim();
        console.log(`[CLI LOOP] Providing input for goal: ${goalId}`);
        humanLoopBus.provideHumanInput(goalId, response);
      } else {
        console.log(`Usage: respond <goalId> <your input>`);
      }
    }
  });

  console.log("[CLI HUMAN LOOP] Active — listening for human intervention requests.");
}
