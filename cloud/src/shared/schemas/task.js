export const TASK_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed"
};

export function createTask({
  intent = null,
  objective = "",
  target = null,
  context = {},
  dependsOn = [],
  successCriteria = [],
  requires = [],
  produces = []
}) {

  return {
    id: crypto.randomUUID(),

    intent,

    objective,

    target,

    context,

    dependsOn,

    successCriteria,

    requires,

    produces,

    plan: null,

    result: null,

    currentStep: 0,

    status: TASK_STATUS.PENDING,

    createdAt:
      new Date().toISOString()
  };
}