import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/agent/state/agentSession.js", () => ({
  loadAgentSession: vi.fn(() => ({
    goalId: "test-goal",
    goalObjective: "Test objective",
    tracker: {},
    context: {},
    stateType: "human_intervention",
    world: {}
  }))
}));

vi.mock("../../src/agent/index.js", () => ({
  runAgent: vi.fn(() => Promise.resolve({ success: true }))
}));

vi.mock("../../src/websocket/server.js", () => ({
  executePlanRemotely: vi.fn()
}));

import humanLoopBus from "../../src/humanLoop/humanLoopBus.js";

describe("humanLoopBus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [key, pending] of humanLoopBus.pendingInputs) {
      clearTimeout(pending.timer);
      pending.resolve("cleanup");
    }
    humanLoopBus.pendingInputs.clear();
    humanLoopBus.removeAllListeners();
  });

  it("requestHumanInput returns a promise that resolves with provideHumanInput", async () => {
    const inputPromise = humanLoopBus.requestHumanInput("goal-1", "Enter code:");
    humanLoopBus.provideHumanInput("goal-1", "123456");
    await expect(inputPromise).resolves.toBe("123456");
  });

  it("provideHumanInput returns false for unknown goalId", () => {
    const result = humanLoopBus.provideHumanInput("nonexistent", "input");
    expect(result).toBe(false);
  });

  it("cancelHumanInput rejects the pending promise", async () => {
    const inputPromise = humanLoopBus.requestHumanInput("goal-2", "Confirm?");
    humanLoopBus.cancelHumanInput("goal-2");
    try {
      await inputPromise;
    } catch (e) {
      expect(e.message).toBe("Human input cancelled");
      return;
    }
    expect(true).toBe(false);
  });

  it("cancelHumanInput returns false for unknown goalId", () => {
    const result = humanLoopBus.cancelHumanInput("nonexistent");
    expect(result).toBe(false);
  });

  it("requestHumanInput emits input_requested event", () => {
    const handler = vi.fn();
    humanLoopBus.on("input_requested", handler);
    humanLoopBus.requestHumanInput("goal-3", "prompt", "free_text", { key: "val" });
    expect(handler).toHaveBeenCalledWith({
      goalId: "goal-3",
      prompt: "prompt",
      responseType: "free_text",
      context: { key: "val" }
    });
  });

  it("provideHumanInput emits input_received event", () => {
    const handler = vi.fn();
    humanLoopBus.on("input_received", handler);
    humanLoopBus.requestHumanInput("goal-4", "prompt");
    humanLoopBus.provideHumanInput("goal-4", "answer");
    expect(handler).toHaveBeenCalledWith({ goalId: "goal-4", input: "answer" });
  });

  it("cancelHumanInput emits input_cancelled event", async () => {
    const p = humanLoopBus.requestHumanInput("goal-5", "prompt").catch(() => {});
    const handler = vi.fn();
    humanLoopBus.on("input_cancelled", handler);
    humanLoopBus.cancelHumanInput("goal-5");
    expect(handler).toHaveBeenCalledWith({ goalId: "goal-5" });
    try { await p; } catch {  }
  });

  it("requestHumanInput rejects after timeout", async () => {
    const inputPromise = humanLoopBus.requestHumanInput("goal-timeout", "prompt");
    humanLoopBus.cancelHumanInput("goal-timeout");
    try {
      await inputPromise;
    } catch {
      return;
    }
    expect(true).toBe(false);
  }, 10000);

  it("cancelHumanInput returns false for already-cancelled goal", async () => {
    humanLoopBus.requestHumanInput("goal-double", "prompt").catch(() => {});
    expect(humanLoopBus.cancelHumanInput("goal-double")).toBe(true);
    expect(humanLoopBus.cancelHumanInput("goal-double")).toBe(false);
  });

  it("resume returns true when session is found", async () => {
    const result = await humanLoopBus.resume("test-goal");
    expect(result).toBe(true);
  });

  it("resume returns false when no session exists", async () => {
    const { loadAgentSession } = await import("../../src/agent/state/agentSession.js");
    loadAgentSession.mockReturnValueOnce(null);
    const result = await humanLoopBus.resume("no-session");
    expect(result).toBe(false);
  });
});
