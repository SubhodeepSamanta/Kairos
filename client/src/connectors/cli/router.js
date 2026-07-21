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
        const goalId = pendingAskGoalId;
        waitingForAnswer = false;
        pendingAskGoalId = null;
        sendHumanReply(goalId, text);
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
