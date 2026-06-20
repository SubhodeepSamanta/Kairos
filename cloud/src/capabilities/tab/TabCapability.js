export const TabCapability = {
  name: "TabCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.90,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "new_tab" || transition.desiredState === "switch_tab" || transition.desiredState === "close_tab";
  },
  execute(transition, browserState) {
    if (transition.desiredState === "new_tab") {
      return { success: true, actions: [{ type: "new_tab", params: {} }] };
    }
    if (transition.desiredState === "switch_tab") {
      return { success: true, actions: [{ type: "switch_tab", params: { index: transition.parameters?.index } }] };
    }
    if (transition.desiredState === "close_tab") {
      return { success: true, actions: [{ type: "close_tab", params: { index: transition.parameters?.index } }] };
    }
    return { success: false, reason: `Unsupported tab action: ${transition.desiredState}` };
  },
  verify(transition, observation) {
    return observation && observation.success !== false;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] TabCapability handling failure: ${failure.type}`);
    return null;
  }
};
