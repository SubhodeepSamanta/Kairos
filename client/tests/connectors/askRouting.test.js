import { describe, it, expect, vi } from "vitest";
import { createGoalRouter } from "../../src/connectors/cli/router.js";

function makeRouter({ online = true } = {}) {
  const sentGoals = [];
  const humanReplies = [];
  const cancels = [];

  const router = createGoalRouter({
    sendGoal: vi.fn((text, tone) => { if (!online) return false; sentGoals.push({ text, tone }); return true; }),
    sendHumanReply: vi.fn((goalId, input) => { if (!online) return false; humanReplies.push({ goalId, input }); return true; }),
    sendCancel: vi.fn(() => cancels.push(true))
  });

  return { router, sentGoals, humanReplies, cancels };
}

describe("answering a question she asked", () => {
  it("sends a spoken answer back to the waiting goal, not as a new one", () => {
    const c = makeRouter();
    c.router.ask("goal-1");

    expect(c.router.submit("the first one")).toBe("answered");
    expect(c.humanReplies).toEqual([{ goalId: "goal-1", input: "the first one" }]);
    expect(c.sentGoals).toHaveLength(0);
  });

  it("only swallows one utterance, then goes back to normal goals", () => {
    const c = makeRouter();
    c.router.ask("goal-3");
    c.router.submit("the first one");
    c.router.submit("now open my inbox");

    expect(c.humanReplies).toHaveLength(1);
    expect(c.sentGoals.map(g => g.text)).toEqual(["now open my inbox"]);
  });

  it("treats speech as a goal when nothing is waiting", () => {
    const c = makeRouter();
    c.router.submit("open my inbox");

    expect(c.sentGoals.map(g => g.text)).toEqual(["open my inbox"]);
    expect(c.humanReplies).toHaveLength(0);
  });

  it("carries the tone of voice through with the goal", () => {
    const c = makeRouter();
    c.router.submit("open my inbox", "tired");
    expect(c.sentGoals[0]).toEqual({ text: "open my inbox", tone: "tired" });
  });
});

describe("answering while the cloud is unreachable", () => {
  it("keeps waiting instead of silently losing the answer", () => {
    const c = makeRouter({ online: false });
    c.router.ask("goal-9");

    expect(c.router.submit("the blue one")).toBe("offline");
    expect(c.router.isAwaitingAnswer()).toBe(true);
    expect(c.humanReplies).toHaveLength(0);

    expect(c.router.submit("the blue one")).toBe("offline");
    expect(c.router.isAwaitingAnswer()).toBe(true);
  });
});

describe("a question that never got answered", () => {
  it("stops waiting once the goal finishes, so the next thing you say is a new goal", () => {
    const c = makeRouter();
    c.router.ask("goal-timeout");
    expect(c.router.isAwaitingAnswer()).toBe(true);

    c.router.finish();
    expect(c.router.isAwaitingAnswer()).toBe(false);

    c.router.submit("never mind, check the weather");
    expect(c.humanReplies).toHaveLength(0);
    expect(c.sentGoals.map(g => g.text)).toEqual(["never mind, check the weather"]);
  });
});

describe("goal tracking", () => {
  it("does not claim a goal is running when the send failed", () => {
    const c = makeRouter({ online: false });
    expect(c.router.submit("open my inbox")).toBe("offline");
    expect(c.router.isBusy()).toBe(false);
  });

  it("refuses to cancel when nothing is running", () => {
    const c = makeRouter();
    expect(c.router.cancel()).toBe(false);
    expect(c.cancels).toHaveLength(0);
  });

  it("cancels a goal that is actually running", () => {
    const c = makeRouter();
    c.router.submit("book me a flight");
    expect(c.router.cancel()).toBe(true);
    expect(c.cancels).toHaveLength(1);
  });

  it("stops being busy once the goal comes back", () => {
    const c = makeRouter();
    c.router.submit("book me a flight");
    expect(c.router.isBusy()).toBe(true);
    c.router.finish();
    expect(c.router.isBusy()).toBe(false);
  });
});
