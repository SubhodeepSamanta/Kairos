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
      actionHistory: [],
      lastAction: null,
      lastOutcome: null,
      history: [],
      lastUrl: null,
      lastTitle: null,
      progressIndicators: { totalActions: 0, unchangedPagesCount: 0 }
    },

    createdAt:
      new Date().toISOString()
  };
}