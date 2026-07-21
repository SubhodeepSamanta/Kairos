import { describe, it, expect, vi, beforeEach } from "vitest";

const askLLMJson = vi.fn();

vi.mock("../../src/llm/provider.js", () => ({
  askLLMJson: (...args) => askLLMJson(...args),
  createBudget: (maxCalls) => ({ used: 0, maxCalls, estimatedTokens: 0 })
}));

const { runAgent } = await import("../../src/agent/loop/agentLoop.js");

const cartPage = {
  url: "https://shop.example.com/cart",
  title: "Cart",
  buttons: [{ id: 1, text: "Buy now" }, { id: 2, text: "Add to cart" }],
  inputs: [], links: []
};

function scripted(steps) {
  let i = 0;
  askLLMJson.mockImplementation(async () => steps[Math.min(i++, steps.length - 1)]);
}

beforeEach(() => askLLMJson.mockReset());

describe("confirming before something irreversible", () => {
  it("asks before spending money and does not click until you say yes", async () => {
    scripted([
      { thought: "open the cart", action: { type: "navigate", url: "https://shop.example.com/cart" } },
      { thought: "buy it", action: { type: "click", id: 1 } },
      { thought: "bought", action: { type: "done", success: true, answer: "ordered" } }
    ]);

    const executed = [];
    const asked = [];

    const result = await runAgent({
      goal: "buy the thing in my cart",
      chatId: "confirm-yes",
      executeAction: async (a) => { executed.push(a); return { success: true, page: cartPage }; },
      askHuman: async (q) => { asked.push(q); return "yes"; },
      isCancelled: () => false
    });

    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/spend money/);
    expect(asked[0]).toMatch(/Buy now/);
    expect(executed.some(a => a.type === "click")).toBe(true);
    expect(result.success).toBe(true);
  });

  it("never clicks when you say no", async () => {
    scripted([
      { thought: "open the cart", action: { type: "navigate", url: "https://shop.example.com/cart" } },
      { thought: "buy it", action: { type: "click", id: 1 } },
      { thought: "they refused", action: { type: "done", success: false, answer: "left it in the cart" } }
    ]);

    const executed = [];
    const result = await runAgent({
      goal: "buy the thing in my cart",
      chatId: "confirm-no",
      executeAction: async (a) => { executed.push(a); return { success: true, page: cartPage }; },
      askHuman: async () => "no",
      isCancelled: () => false
    });

    expect(executed.some(a => a.type === "click")).toBe(false);
    expect(result.answer).toMatch(/cart/i);
  });

  it("treats a non-answer as a no", async () => {
    scripted([
      { thought: "open the cart", action: { type: "navigate", url: "https://shop.example.com/cart" } },
      { thought: "buy it", action: { type: "click", id: 1 } },
      { thought: "stopping", action: { type: "done", success: false, answer: "did not buy" } }
    ]);

    const executed = [];
    await runAgent({
      goal: "buy the thing",
      chatId: "confirm-vague",
      executeAction: async (a) => { executed.push(a); return { success: true, page: cartPage }; },
      askHuman: async () => "hmm i'm not sure",
      isCancelled: () => false
    });

    expect(executed.some(a => a.type === "click")).toBe(false);
  });

  it("does not interrupt an ordinary click", async () => {
    scripted([
      { thought: "open the cart", action: { type: "navigate", url: "https://shop.example.com/cart" } },
      { thought: "add it", action: { type: "click", id: 2 } },
      { thought: "added", action: { type: "done", success: true, answer: "added to cart" } }
    ]);

    const asked = [];
    const executed = [];
    await runAgent({
      goal: "add it to my cart",
      chatId: "confirm-plain",
      executeAction: async (a) => { executed.push(a); return { success: true, page: cartPage }; },
      askHuman: async (q) => { asked.push(q); return "yes"; },
      isCancelled: () => false
    });

    expect(asked).toHaveLength(0);
    expect(executed.some(a => a.type === "click")).toBe(true);
  });

  it("can be turned off entirely", async () => {
    scripted([
      { thought: "open the cart", action: { type: "navigate", url: "https://shop.example.com/cart" } },
      { thought: "buy it", action: { type: "click", id: 1 } },
      { thought: "done", action: { type: "done", success: true, answer: "ordered" } }
    ]);

    const asked = [];
    const executed = [];
    await runAgent({
      goal: "buy it",
      chatId: "confirm-off",
      confirmRisky: false,
      executeAction: async (a) => { executed.push(a); return { success: true, page: cartPage }; },
      askHuman: async (q) => { asked.push(q); return "yes"; },
      isCancelled: () => false
    });

    expect(asked).toHaveLength(0);
    expect(executed.some(a => a.type === "click")).toBe(true);
  });
});

describe("dry run", () => {
  it("plans without touching anything", async () => {
    scripted([
      { thought: "open the cart", action: { type: "navigate", url: "https://shop.example.com/cart" } },
      { thought: "buy it", action: { type: "click", id: 1 } },
      { thought: "describe instead", action: { type: "done", success: true, answer: "I would have clicked Buy now" } }
    ]);

    const executed = [];
    const asked = [];
    const result = await runAgent({
      goal: "buy the thing",
      chatId: "dry-run",
      dryRun: true,
      executeAction: async (a) => { executed.push(a); return { success: true, page: cartPage }; },
      askHuman: async (q) => { asked.push(q); return "yes"; },
      isCancelled: () => false
    });

    expect(executed.some(a => a.type === "click")).toBe(false);
    expect(executed.some(a => a.type === "navigate")).toBe(true);
    expect(asked).toHaveLength(0);
    expect(result.answer).toMatch(/would have/i);
  });
});
