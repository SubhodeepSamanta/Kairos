import { describe, it, expect, vi } from "vitest";

function makeConsole() {
  const sentGoals = [];
  const humanReplies = [];
  let waitingForAnswer = false;
  let pendingAskGoalId = null;
  let goalInFlight = false;

  const sendGoal = vi.fn((text) => { sentGoals.push(text); return true; });
  const sendHumanReply = vi.fn((goalId, input) => humanReplies.push({ goalId, input }));

  function answerPending(text) {
    if (!waitingForAnswer) return false;
    const goalId = pendingAskGoalId;
    waitingForAnswer = false;
    pendingAskGoalId = null;
    sendHumanReply(goalId, text);
    return true;
  }

  return {
    sentGoals, humanReplies,
    ask: (goalId) => { waitingForAnswer = true; pendingAskGoalId = goalId; },
    speak: (text) => {
      if (answerPending(text)) return;
      if (sendGoal(text)) goalInFlight = true;
    },
    type: (text) => {
      if (answerPending(text)) return;
      if (sendGoal(text)) goalInFlight = true;
    },
    isBusy: () => goalInFlight
  };
}

describe("answering a question she asked", () => {
  it("sends a spoken answer back to the waiting goal, not as a new one", () => {
    const c = makeConsole();
    c.ask("goal-1");
    c.speak("the first one");

    expect(c.humanReplies).toEqual([{ goalId: "goal-1", input: "the first one" }]);
    expect(c.sentGoals).toHaveLength(0);
  });

  it("sends a typed answer back the same way", () => {
    const c = makeConsole();
    c.ask("goal-2");
    c.type("yes please");

    expect(c.humanReplies[0].input).toBe("yes please");
    expect(c.sentGoals).toHaveLength(0);
  });

  it("only swallows one utterance, then goes back to normal goals", () => {
    const c = makeConsole();
    c.ask("goal-3");
    c.speak("the first one");
    c.speak("now open my inbox");

    expect(c.humanReplies).toHaveLength(1);
    expect(c.sentGoals).toEqual(["now open my inbox"]);
  });

  it("treats speech as a goal when nothing is waiting", () => {
    const c = makeConsole();
    c.speak("open my inbox");
    expect(c.sentGoals).toEqual(["open my inbox"]);
    expect(c.humanReplies).toHaveLength(0);
  });
});

describe("goal tracking when offline", () => {
  it("does not claim a goal is running when the send failed", () => {
    let goalInFlight = false;
    const sendGoal = () => false;
    if (sendGoal()) goalInFlight = true;
    expect(goalInFlight).toBe(false);
  });
});
