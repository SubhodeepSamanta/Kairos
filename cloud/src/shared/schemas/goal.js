export function createGoal(objective) {
  return {
    id: crypto.randomUUID(),

    objective,

    intent: null,

    tasks: [],

    currentTask: 0,

    status: "pending",

    world: {
      entities: [],
      tabs: [],
      findings: [],
      completedTasks: [],
      failedTasks: [],
      failedActionHistory: [],
      lastAction: null,
      lastOutcome: null,
      history: [],
      lastUrl: null,
      lastTitle: null
    },

    createdAt:
      new Date().toISOString()
  };
}