import { resolveCurrentState } from "../../world/currentStateResolver.js";

export const FormCapability = {
  name: "FormCapability",
  executions: 0,
  successes: 0,
  failures: 0,
  successRate: 1.0,
  confidence: 0.85,
  success_by_environment: {},
  canHandle(transition) {
    return transition.desiredState === "form_submitted" || transition.desiredState === "logged_in";
  },
  execute(transition, browserState) {
    const actions = [];
    let matchedBySemantic = false;
    let fallbackToLegacy = false;

    let emailInput = (browserState.inputs || []).find(input => input.semanticType === "input_element" && (input.type === "email" || (input.name && input.name.includes("email"))));
    if (emailInput) {
      matchedBySemantic = true;
    } else {
      emailInput = (browserState.inputs || []).find(input => input.purpose === "login_email");
      if (emailInput) fallbackToLegacy = true;
    }

    let passwordInput = (browserState.inputs || []).find(input => input.semanticType === "input_element" && (input.type === "password" || (input.name && input.name.includes("pass"))));
    if (passwordInput) {
      matchedBySemantic = true;
    } else {
      passwordInput = (browserState.inputs || []).find(input => input.purpose === "login_password");
      if (passwordInput) fallbackToLegacy = true;
    }

    let submitBtn = (browserState.buttons || []).find(btn => btn.semanticType === "action_button" || btn.semanticType === "primary_action");
    if (submitBtn) {
      matchedBySemantic = true;
    } else {
      submitBtn = (browserState.buttons || []).find(btn => btn.purpose === "login_button" || btn.purpose === "submit_button");
      if (submitBtn) fallbackToLegacy = true;
    }

    console.log(`[SEMANTIC CAPABILITY] name="FormCapability" matched_by_semantic=${matchedBySemantic} fallback_to_legacy=${fallbackToLegacy}`);

    if (emailInput && !emailInput.value) {
      actions.push({
        type: "type",
        params: {
          element: emailInput.id,
          text: transition.parameters?.email || "user@example.com"
        }
      });
    }
    if (passwordInput && !passwordInput.value) {
      actions.push({
        type: "type",
        params: {
          element: passwordInput.id,
          text: transition.parameters?.password || "password"
        }
      });
    }
    if (submitBtn) {
      actions.push({
        type: "click",
        params: {
          element: submitBtn.id
        }
      });
    }
    if (actions.length > 0) return { success: true, actions };
    return { success: false, reason: "No relevant login fields or submit buttons available to execute" };
  },
  verify(transition, observation) {
    if (!observation) return false;
    const resolved = resolveCurrentState(observation);
    const pageText = (observation.text || "").toLowerCase();
    const isLoginWall = pageText.includes("sign in") || pageText.includes("login") || pageText.includes("password");
    return !isLoginWall && observation.success !== false;
  },
  recover(failure, transition) {
    console.log(`[RECOVERY] FormCapability handling failure: ${failure.type}`);
    return null;
  }
};
