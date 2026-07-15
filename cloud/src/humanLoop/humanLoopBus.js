import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { loadAgentSession } from "../agent/state/agentSession.js";

class HumanLoopBus extends EventEmitter {
  constructor() {
    super();
    this.pendingInputs = new Map();
  }

  requestHumanInput(goalId, prompt, responseType = "free_text", context = {}) {
    return new Promise((resolve, reject) => {
      const timeout = 300000;
      const timer = setTimeout(() => {
        this.pendingInputs.delete(goalId);
        reject(new Error("Human input request timed out after 5 minutes"));
      }, timeout);

      this.pendingInputs.set(goalId, { resolve, reject, timer, prompt, responseType, context });
      this.emit("input_requested", { goalId, prompt, responseType, context });
    });
  }

  provideHumanInput(goalId, input) {
    const pending = this.pendingInputs.get(goalId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pendingInputs.delete(goalId);
    pending.resolve(input);
    this.emit("input_received", { goalId, input });
    return true;
  }

  cancelHumanInput(goalId) {
    const pending = this.pendingInputs.get(goalId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pendingInputs.delete(goalId);
    pending.reject(new Error("Human input cancelled"));
    this.emit("input_cancelled", { goalId });
    return true;
  }

  async resume(goalId) {
    const session = loadAgentSession(goalId);
    if (!session) {
      console.warn(`[HUMAN LOOP] No session found to resume for goal: ${goalId}`);
      return false;
    }

    this.emit("intervention_resolved", { goalId });

    const goal = {
      id: session.goalId,
      objective: session.goalObjective,
      tracker: session.tracker,
      context: session.context,
      workflowMemory: session.workflowMemory,
      world: {
        findings: session.world?.findings || session.findings || [],
        history: session.world?.history || [],
        failedActionHistory: session.world?.failedActionHistory || [],
        actionHistory: session.world?.actionHistory || [],
        entities: session.world?.entities || [],
        tabs: session.world?.tabs || [],
        completedTasks: session.world?.completedTasks || [],
        failedTasks: session.world?.failedTasks || [],
        lastAction: session.world?.lastAction || null,
        lastOutcome: session.world?.lastOutcome || null,
        lastUrl: session.world?.lastUrl || null,
        lastTitle: session.world?.lastTitle || null,
        progressIndicators: session.world?.progressIndicators || { totalActions: 0, unchangedPagesCount: 0 }
      }
    };

    setTimeout(async () => {
      try {
        console.log(`[HUMAN LOOP] Resuming agent execution for goal: ${goalId}`);
        const { runAgent } = await import("../agent/index.js");
        const { executePlanRemotely } = await import("../websocket/server.js");
        const result = await runAgent({ goal, executePlan: executePlanRemotely });
        console.log(`[HUMAN LOOP] Agent execution completed after resume. Success: ${result.success}`);
      } catch (err) {
        console.error(`[HUMAN LOOP] Error running agent after resume:`, err);
      }
    }, 0);

    return true;
  }

  cancel(goalId) {
    this.cancelHumanInput(goalId);
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
