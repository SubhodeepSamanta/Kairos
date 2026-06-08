export function createGoal(objective) {
  return {
    id: crypto.randomUUID(),
    objective,
    createdAt: new Date().toISOString()
  };
}