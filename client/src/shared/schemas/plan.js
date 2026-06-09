export function createPlan(
  goalId,
  actions = []
) {
  return {
    goalId,
    actions,
    createdAt:
      new Date().toISOString()
  };
}