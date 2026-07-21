import { describe, it, expect, vi, beforeEach } from "vitest";

const runAgent = vi.fn();

vi.mock("../../src/agent/loop/agentLoop.js", () => ({
  runAgent: (...args) => runAgent(...args)
}));

vi.mock("../../src/companion/commands.js", () => ({
  isCommand: () => false,
  runCommand: async () => ""
}));

const { submitGoal, cancelGoals } = await import("../../src/agent/goalManager.js");

const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  runAgent.mockReset();
});

describe("cancelling goals that never started", () => {
  it("tells the waiting goals they were dropped instead of leaving them hanging", async () => {
    let release;
    runAgent.mockImplementation(() => new Promise((r) => { release = () => r({ success: true, answer: "done" }); }));

    const results = [];
    const submit = (goal) => submitGoal({
      goal,
      chatId: "drop",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      onStatus: () => {},
      onResult: (success, result) => results.push({ goal, success, result })
    });

    submit("first");
    await settle();
    submit("second");
    submit("third");

    const { wasRunning, dropped } = cancelGoals();
    expect(wasRunning).toBe(true);
    expect(dropped).toBe(2);

    expect(results.map(r => r.goal)).toEqual(["second", "third"]);
    for (const r of results) {
      expect(r.success).toBe(false);
      expect(r.result).toMatch(/dropped/i);
    }

    release();
    await settle();
  });

  it("does not run a goal that was cancelled while it sat in the queue", async () => {
    let release;
    runAgent.mockImplementation(() => new Promise((r) => { release = () => r({ success: true, answer: "done" }); }));

    submitGoal({
      goal: "running",
      chatId: "drop",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      onStatus: () => {},
      onResult: () => {}
    });
    await settle();

    submitGoal({
      goal: "queued",
      chatId: "drop",
      executeAction: async () => ({ success: true }),
      askHuman: async () => "",
      onStatus: () => {},
      onResult: () => {}
    });

    cancelGoals();
    release();
    await settle();

    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAgent.mock.calls[0][0].goal).toBe("running");
  });
});
