export const TASK_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  BLOCKED: "blocked",
  WAITING_FOR_USER: "waiting_for_user"
};

export function createTask({
  intent,
  target = null,
  context = {},
  dependsOn = []
}) {

return {
  id: crypto.randomUUID(),

  intent,

  target,

  context,

  dependsOn,

  plan: null,

  result: null,

  currentStep: 0,

  status:
    TASK_STATUS.PENDING,

  createdAt:
    new Date().toISOString()
};
}