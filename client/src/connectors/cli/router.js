export function createGoalRouter({ sendGoal, sendHumanReply, sendCancel }) {
  let pendingAskGoalId = null;
  let waitingForAnswer = false;
  let goalInFlight = false;

  return {
    isBusy: () => goalInFlight,
    isAwaitingAnswer: () => waitingForAnswer,

    ask(goalId) {
      pendingAskGoalId = goalId;
      waitingForAnswer = true;
    },

    submit(text, tone) {
      if (waitingForAnswer) {
        if (sendHumanReply(pendingAskGoalId, text) === false) return "offline";
        waitingForAnswer = false;
        pendingAskGoalId = null;
        return "answered";
      }
      if (!sendGoal(text, tone)) return "offline";
      goalInFlight = true;
      return "sent";
    },

    finish() {
      goalInFlight = false;
      waitingForAnswer = false;
      pendingAskGoalId = null;
    },

    cancel() {
      if (!goalInFlight) return false;
      sendCancel();
      return true;
    }
  };
}
