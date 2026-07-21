import { describe, it, expect, vi, beforeEach } from "vitest";

const llmQueue = [];
vi.mock("../../src/llm/provider.js", () => ({
  createBudget: (max) => ({ used: 0, estimatedTokens: 0, max }),
  askLLMJson: vi.fn(async (system, user, budget) => {
    budget.used++;
    const next = llmQueue.shift();
    return typeof next === "function" ? next(system, user) : next;
  })
}));

const { runAgent } = await import("../../src/agent/loop/agentLoop.js");

describe("stopping a goal that is already running", () => {
  beforeEach(() => { llmQueue.length = 0; });

  it("stops before taking another step", async () => {
    let cancelled = false;
    const calls = [];
    llmQueue.push({ thought: "", action: { type: "navigate", url: "https://example.com" } });
    llmQueue.push({ thought: "", action: { type: "navigate", url: "https://example.com/2" } });

    const executeAction = vi.fn(async (a) => {
      calls.push(a.type);
      cancelled = true;
      return { success: true, observation: { url: "https://example.com", elements: [] } };
    });

    const result = await runAgent({
      goal: "browse a bit", goalId: "c1", executeAction, askHuman: vi.fn(),
      isCancelled: () => cancelled
    });

    expect(result.success).toBe(false);
    expect(result.answer).toMatch(/stopped/i);
    expect(calls).toHaveLength(1);
  });

  it("does not run an action it had already decided on", async () => {
    const executeAction = vi.fn(async () => ({ success: true, observation: { url: "x", elements: [] } }));
    llmQueue.push({ thought: "", action: { type: "navigate", url: "https://example.com" } });

    const result = await runAgent({
      goal: "go somewhere", goalId: "c2", executeAction, askHuman: vi.fn(),
      isCancelled: () => true
    });

    expect(executeAction).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it("runs normally when nothing cancels it", async () => {
    llmQueue.push({ thought: "", action: { type: "done", success: true, answer: "all good" } });
    const result = await runAgent({
      goal: "say hi", goalId: "c3", executeAction: vi.fn(), askHuman: vi.fn(),
      isCancelled: () => false
    });
    expect(result.success).toBe(true);
    expect(result.answer).toBe("all good");
  });

  it("survives a cancellation check that throws", async () => {
    llmQueue.push({ thought: "", action: { type: "done", success: true, answer: "fine" } });
    const result = await runAgent({
      goal: "say hi", goalId: "c4", executeAction: vi.fn(), askHuman: vi.fn(),
      isCancelled: () => { throw new Error("boom"); }
    });
    expect(result.success).toBe(true);
  });
});
