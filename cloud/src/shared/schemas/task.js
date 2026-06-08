export const TASK_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed"
};

export function createTask(goal, plan) {
  return {
    id: crypto.randomUUID(),
    goal,
    plan,
    currentStep: 0,
    status: TASK_STATUS.PENDING,
    createdAt: new Date().toISOString()
  };
}