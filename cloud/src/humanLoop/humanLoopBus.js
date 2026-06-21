/**
 * Human-in-the-loop (HITL) Event Bus
 * 
 * Future connectors (e.g. Telegram) should import this singleton:
 *   import humanLoopBus from "../humanLoop/humanLoopBus.js";
 * 
 * Subscribe to intervention needs:
 *   humanLoopBus.on("intervention_needed", ({ goalId, reason, state, pageUrl, pageTitle }) => { ... });
 * 
 * Resume a goal execution:
 *   await humanLoopBus.resume(goalId);
 * 
 * Cancel a goal execution:
 *   await humanLoopBus.cancel(goalId);
 */

import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { loadAgentSession } from "../agent/state/agentSession.js";
import { runAgent } from "../agent/index.js";
import { executePlanRemotely } from "../websocket/server.js";

class HumanLoopBus extends EventEmitter {
  constructor() {
    super();
  }

  async resume(goalId) {
    const session = loadAgentSession(goalId);
    if (!session) {
      console.warn(`[HUMAN LOOP] No session found to resume for goal: ${goalId}`);
      return false;
    }

    this.emit("intervention_resolved", { goalId });

    // Reconstruct goal object from session
    const goal = {
      id: session.goalId,
      objective: session.goalObjective,
      tracker: session.tracker,
      context: session.context,
      workflowMemory: session.workflowMemory,
      world: {
        findings: session.findings || [],
        history: [],
        failedActionHistory: [],
        actionHistory: [],
        entities: [],
        tabs: [],
        completedTasks: [],
        failedTasks: [],
        lastAction: null,
        lastOutcome: null,
        lastUrl: null,
        lastTitle: null,
        progressIndicators: { totalActions: 0, unchangedPagesCount: 0 }
      }
    };

    // Re-run the agent loop asynchronously
    setTimeout(async () => {
      try {
        console.log(`[HUMAN LOOP] Resuming agent execution for goal: ${goalId}`);
        const result = await runAgent({
          goal,
          executePlan: executePlanRemotely
        });
        console.log(`[HUMAN LOOP] Agent execution completed after resume. Success: ${result.success}`);
      } catch (err) {
        console.error(`[HUMAN LOOP] Error running agent after resume:`, err);
      }
    }, 0);

    return true;
  }

  cancel(goalId) {
    const filePath = path.join(process.cwd(), "sessions", `session_${goalId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[HUMAN LOOP] Deleted session file: ${filePath}`);
      } catch (err) {
        console.error(`[HUMAN LOOP] Error deleting session file:`, err);
      }
    }
    this.emit("intervention_cancelled", { goalId });
  }
}

const humanLoopBus = new HumanLoopBus();
export default humanLoopBus;
