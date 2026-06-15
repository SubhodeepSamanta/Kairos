export function createGoal(objective) {
  return {
    id: crypto.randomUUID(),

    objective,

    intent: null,

    tasks: [],

    currentTask: 0,

    status: "pending",

    createdAt:
      new Date().toISOString()
  };
}