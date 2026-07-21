import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildStepPrompt } from "../../src/agent/prompt.js";

const askLLMJson = vi.fn();
vi.mock("../../src/llm/provider.js", () => ({
  askLLMJson: (...args) => askLLMJson(...args),
  createBudget: (maxCalls) => ({ used: 0, maxCalls, estimatedTokens: 0, tokensIn: 0, tokensOut: 0, measured: 0, llmMs: 0 })
}));
const { runAgent } = await import("../../src/agent/loop/agentLoop.js");

beforeEach(() => askLLMJson.mockReset());

const base = {
  goal: "x", memories: "none", history: [], snapshot: "none",
  notice: "", summary: "", conversation: "", recentDays: "", mood: ""
};

describe("the plan block", () => {
  it("is absent entirely when there is no plan, so it costs nothing", () => {
    expect(buildStepPrompt(base)).not.toContain("YOUR PLAN");
    expect(buildStepPrompt({ ...base, plan: [] })).not.toContain("YOUR PLAN");
  });

  it("is numbered and framed as hers to revise", () => {
    const prompt = buildStepPrompt({ ...base, plan: ["search for the page", "open the first result"] });
    expect(prompt).toContain("1. search for the page");
    expect(prompt).toContain("2. open the first result");
    expect(prompt).toMatch(/revise it/i);
  });
});

describe("re-planning when she is stuck", () => {
  it("asks for a plan once the same action keeps failing", async () => {
    const prompts = [];
    askLLMJson.mockImplementation(async (_s, userPrompt) => {
      prompts.push(userPrompt);
      return { thought: "try again", action: { type: "click", id: 1 } };
    });

    await runAgent({
      goal: "click the thing",
      chatId: "replan-ask",
      executeAction: async () => ({ success: false, reason: "not found", page: { url: "https://x.com", buttons: [{ id: 1, text: "Go" }] } }),
      askHuman: async () => "",
      isCancelled: () => false
    });

    expect(prompts.some(p => /Stop and re-plan/.test(p))).toBe(true);
  });

  it("carries a plan she sends into the next turn", async () => {
    const prompts = [];
    let i = 0;
    askLLMJson.mockImplementation(async (_s, userPrompt) => {
      prompts.push(userPrompt);
      i++;
      if (i === 1) {
        return {
          thought: "new approach",
          plan: ["search for the real url", "navigate straight there"],
          action: { type: "web_search", query: "the real url" }
        };
      }
      return { thought: "done", action: { type: "done", success: true, answer: "found it" } };
    });

    await runAgent({
      goal: "find the thing",
      chatId: "replan-carry",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      isCancelled: () => false
    });

    expect(prompts[0]).not.toContain("YOUR PLAN");
    expect(prompts[1]).toContain("YOUR PLAN");
    expect(prompts[1]).toContain("search for the real url");
  });

  it("lets her replace a plan that stopped fitting", async () => {
    const prompts = [];
    let i = 0;
    askLLMJson.mockImplementation(async (_s, userPrompt) => {
      prompts.push(userPrompt);
      i++;
      if (i === 1) return { thought: "a", plan: ["first idea"], action: { type: "web_search", query: "a" } };
      if (i === 2) return { thought: "b", plan: ["better idea"], action: { type: "web_search", query: "b" } };
      return { thought: "done", action: { type: "done", success: true, answer: "ok" } };
    });

    await runAgent({
      goal: "find the thing",
      chatId: "replan-replace",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      isCancelled: () => false
    });

    expect(prompts[1]).toContain("first idea");
    expect(prompts[2]).toContain("better idea");
    expect(prompts[2]).not.toContain("first idea");
  });

  it("ignores a plan that is not a list of steps", async () => {
    const prompts = [];
    let i = 0;
    askLLMJson.mockImplementation(async (_s, userPrompt) => {
      prompts.push(userPrompt);
      i++;
      if (i === 1) return { thought: "a", plan: "just do it", action: { type: "web_search", query: "a" } };
      return { thought: "done", action: { type: "done", success: true, answer: "ok" } };
    });

    await runAgent({
      goal: "find the thing",
      chatId: "replan-bad",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      isCancelled: () => false
    });

    expect(prompts[1]).not.toContain("YOUR PLAN");
  });
});
