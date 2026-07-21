import { describe, it, expect, vi, beforeEach } from "vitest";

const askLLMJson = vi.fn();

vi.mock("../../src/llm/provider.js", () => ({
  askLLMJson: (...args) => askLLMJson(...args),
  createBudget: (maxCalls) => ({ used: 0, maxCalls, estimatedTokens: 0 })
}));

const { runAgent } = await import("../../src/agent/loop/agentLoop.js");

beforeEach(() => {
  askLLMJson.mockReset();
});

describe("cancelling while she is waiting", () => {
  it("stops during the retry backoff instead of sitting out the full wait", async () => {
    let cancelled = false;
    askLLMJson.mockRejectedValue(new Error("all providers busy"));

    const started = Date.now();
    setTimeout(() => { cancelled = true; }, 150);

    const result = await runAgent({
      goal: "find me a flight",
      goalId: "g1",
      chatId: "cancel-backoff",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      isCancelled: () => cancelled
    });

    expect(result.success).toBe(false);
    expect(result.answer).toMatch(/stopped|never mind/i);
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it("stops while she is waiting on an answer instead of hanging for five minutes", async () => {
    let cancelled = false;
    askLLMJson.mockResolvedValue({
      thought: "need to know which one",
      action: { type: "ask_human", question: "which account?" }
    });

    const started = Date.now();
    setTimeout(() => { cancelled = true; }, 150);

    const result = await runAgent({
      goal: "log me in",
      goalId: "g2",
      chatId: "cancel-ask",
      executeAction: async () => ({ success: true }),
      askHuman: () => new Promise(() => {}),
      isCancelled: () => cancelled
    });

    expect(result.success).toBe(false);
    expect(result.answer).toMatch(/stopped/i);
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it("still reports a real AI failure honestly when nothing was cancelled", async () => {
    askLLMJson.mockRejectedValue(new Error("llm_budget_exceeded: 45 calls"));

    const result = await runAgent({
      goal: "do a thing",
      goalId: "g3",
      chatId: "cancel-none",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      isCancelled: () => false
    });

    expect(result.success).toBe(false);
    expect(result.answer).toMatch(/budget/i);
  });
});
