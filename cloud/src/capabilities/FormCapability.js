import { resolveCurrentState } from "../world/currentStateResolver.js";

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
    const emailInput = (browserState.inputs || []).find(input => input.purpose === "login_email");
    const passwordInput = (browserState.inputs || []).find(input => input.purpose === "login_password");
    const submitBtn = (browserState.buttons || []).find(btn => btn.purpose === "login_button" || btn.purpose === "submit_button");

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
