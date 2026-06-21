import { routeCapability } from "../../capabilities/router.js";
import { createPlan } from "../../shared/schemas/plan.js";
import { isDebug } from "../../utils/logger.js";

export function selectCapabilityAndPlan({
  goal,
  activeTransition,
  browserState
}) {
  const capability = routeCapability(activeTransition, goal.blacklistedCapabilities);
  let plan = null;

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

  return { capability, plan };
}
