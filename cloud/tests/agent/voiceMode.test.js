import { describe, it, expect, vi, beforeEach } from "vitest";
import { VOICE_RULES } from "../../src/agent/prompt.js";

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

describe("spoken mode", () => {
  beforeEach(() => { llmQueue.length = 0; });

  it("adds the spoken-mode rules only when voice is on", async () => {
    let seen = null;
    llmQueue.push((system) => {
      seen = system;
      return { thought: "", action: { type: "done", success: true, answer: "hi" } };
    });
    await runAgent({ goal: "hello", goalId: "v1", executeAction: vi.fn(), askHuman: vi.fn(), voiceMode: true });
    expect(seen).toContain("SPOKEN MODE");
    expect(seen).toContain("Write for the ear");
  });

  it("leaves the prompt clean for typed conversations", async () => {
    let seen = null;
    llmQueue.push((system) => {
      seen = system;
      return { thought: "", action: { type: "done", success: true, answer: "hi" } };
    });
    await runAgent({ goal: "hello", goalId: "v2", executeAction: vi.fn(), askHuman: vi.fn() });
    expect(seen).not.toContain("SPOKEN MODE");
  });

  it("forbids the things that sound wrong read aloud", () => {
    expect(VOICE_RULES).toMatch(/no bullet points/i);
    expect(VOICE_RULES).toMatch(/never read a raw link/i);
  });
});
