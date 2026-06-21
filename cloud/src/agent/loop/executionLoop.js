import { routeCapability } from "../../capabilities/router.js";
import { createPlan } from "../../shared/schemas/plan.js";
import { isDebug } from "../../utils/logger.js";
import { understandPage } from "../../world/pageUnderstanding.js";
import { selectActionCandidates } from "../../reasoning/actionSelector.js";
import { verifyObjective } from "../../verification/objectiveVerifier.js";

const ActionSelectorCapability = {
  name: "ActionSelectorCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.8,
  success_by_environment: {},
  verify(transition, observation) {
    return verifyObjective(transition.objective || transition, observation);
  },
  recover() {
    return null;
  }
};

export function selectCapabilityAndPlan({
  goal,
  activeTransition,
  browserState,
  currentObj = null
}) {
  let capability = routeCapability(activeTransition, goal.blacklistedCapabilities);
  let plan = null;
  const pageUnderstanding = understandPage(browserState);
  const selectorGoal = activeTransition.parameters?.goal || currentObj?.parameters?.goal || goal.objective;
  const selectorInputText = activeTransition.parameters?.query || currentObj?.parameters?.query || selectorGoal;
  const actionCandidates = selectActionCandidates({
    goal: selectorGoal,
    inputText: selectorInputText,
    pageUnderstanding,
    minScore: 20
  });

  if (isDebug()) {
    console.log("[CAPABILITY]", capability ? capability.name : "None");
    console.log(`[CAPABILITY DIAGNOSTIC]
    Transition: ${activeTransition.id}
    Selected Capability: ${capability ? capability.name : "None"}
    Capability Input (desiredState): ${activeTransition.desiredState}
    Capability Input (parameters): ${JSON.stringify(activeTransition.parameters)}`);
  } else {
    console.log(`[CAPABILITY]\n${capability ? capability.name : "None"}`);
  }

  if (capability) {
    if (isDebug()) {
      console.log("DEBUG BROWSER STATE KEYS:", Object.keys(browserState));
      console.log("DEBUG BROWSER STATE INPUTS:", browserState.inputs);
    }
    capability.executions++;
    const capabilityResult = capability.execute(activeTransition, browserState) || { success: false, reason: "No response from capability execute" };
    
    if (isDebug()) {
      console.log("[ACTIONS]", capabilityResult.actions || []);
      console.log(`[CAPABILITY DIAGNOSTIC] Capability Output:`, JSON.stringify(capabilityResult, null, 2));
    }

    if (capabilityResult.success && capabilityResult.actions && capabilityResult.actions.length > 0) {
      plan = createPlan(goal.id, capabilityResult.actions);
    }
  }

  if (!plan && actionCandidates.length > 0) {
    const candidate = actionCandidates.find(item => item.type !== "scroll") || actionCandidates[0];
    if (candidate?.planAction) {
      console.log(`[ACTION SELECTOR] fallback=${candidate.type} score=${candidate.score}`);
      const actions = [candidate.planAction];
      if (candidate.type === "search") {
        actions.push({ type: "press_key", params: { key: "Enter" } });
      }
      actions.push({ type: "read_ui", params: {} });
      plan = createPlan(goal.id, actions);
      if (!capability) {
        capability = ActionSelectorCapability;
        capability.executions++;
      }
    }
  }

  activeTransition.pageUnderstanding = pageUnderstanding;
  activeTransition.actionCandidates = actionCandidates;

  return { capability, plan };
}
