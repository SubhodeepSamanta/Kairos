export function createGoal(objective) {
  return {
  id: crypto.randomUUID(),
  objective,
  intent: null,
  tasks: [],
  createdAt:
    new Date().toISOString()
};
}