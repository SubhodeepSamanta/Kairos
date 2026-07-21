import { describe, it, expect, vi, beforeEach } from "vitest";

const turns = [];
vi.mock("../../src/companion/store.js", async (orig) => {
  const actual = await orig();
  return { ...actual, addTurn: vi.fn(async (chatId, role, text) => { turns.push({ role, text }); }), addEvent: vi.fn(async () => {}), addMood: vi.fn(async () => {}) };
});

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

describe("how their voice sounded", () => {
  beforeEach(() => { llmQueue.length = 0; turns.length = 0; });

  it("never writes the tone into what it remembers they said", async () => {
    llmQueue.push({ thought: "", action: { type: "done", success: true, answer: "hey" } });
    await runAgent({
      goal: "how are you", tone: "quieter than usual, slower than usual",
      goalId: "t1", executeAction: vi.fn(), askHuman: vi.fn()
    });
    const userTurn = turns.find(t => t.role === "user");
    expect(userTurn.text).toBe("how are you");
    expect(userTurn.text).not.toMatch(/tone/i);
  });

  it("still tells the model how they sounded, for this turn only", async () => {
    let seen = null;
    llmQueue.push((system, user) => {
      seen = user;
      return { thought: "", action: { type: "done", success: true, answer: "hey" } };
    });
    await runAgent({
      goal: "how are you", tone: "quieter than usual",
      goalId: "t2", executeAction: vi.fn(), askHuman: vi.fn()
    });
    expect(seen).toContain("quieter than usual");
    expect(seen).toMatch(/never mention it/i);
  });

  it("says nothing about tone when there is none", async () => {
    let seen = null;
    llmQueue.push((system, user) => {
      seen = user;
      return { thought: "", action: { type: "done", success: true, answer: "hey" } };
    });
    await runAgent({ goal: "how are you", goalId: "t3", executeAction: vi.fn(), askHuman: vi.fn() });
    expect(seen).not.toMatch(/How they SOUND/);
  });
});
