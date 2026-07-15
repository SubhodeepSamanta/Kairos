import { createPlan } from "../../shared/schemas/plan.js";
import { updateWorldModel } from "../../world/worldModel.js";
import { saveAgentSession, checkForHumanIntervention, detectOTPInput } from "../state/agentSession.js";
import { requestHumanInputRemotely } from "../../websocket/server.js";

export async function requestHumanIntervention(goal, browserState, pageUnderstanding, bestCandidate, context, workflowMemory, latestObs, executePlan) {
  const intervention = checkForHumanIntervention(browserState, pageUnderstanding, bestCandidate);
  if (!intervention || !intervention.interventionNeeded) return null;

  console.log(`[HUMAN INPUT REQUIRED] ${intervention.reason}`);
  saveAgentSession(goal, goal.tracker, context, intervention.state, null, workflowMemory, {
    humanInputPrompt: intervention.reason,
    humanInputResponseType: intervention.state
  });

  let prompt = intervention.reason;
  let responseType = "confirmation";
  if (intervention.state === "WAITING_FOR_OTP") {
    prompt = "Two-Factor Authentication / OTP detected. Please enter the code:";
    responseType = "otp";
  } else if (intervention.state === "WAITING_FOR_CAPTCHA") {
    prompt = "CAPTCHA detected. Please solve it in the browser, then type 'done':";
    responseType = "confirmation";
  } else if (intervention.state === "WAITING_FOR_PAYMENT_APPROVAL") {
    prompt = "Payment checkout detected. Type 'approve' to confirm or 'cancel':";
    responseType = "confirmation";
  } else if (intervention.state === "WAITING_FOR_DELETION_APPROVAL") {
    prompt = "Destructive action detected. Type 'approve' to confirm or 'cancel':";
    responseType = "confirmation";
  } else if (intervention.state === "WAITING_FOR_CLARIFICATION") {
    prompt = `${intervention.reason}\nWhat would you like the agent to do?`;
    responseType = "free_text";
  }

  try {
    const humanResponse = await requestHumanInputRemotely(
      goal.id, prompt, responseType,
      { url: browserState.url || "", title: browserState.title || "", pagePurpose: pageUnderstanding?.pagePurpose }
    );
    goal.humanInputResponse = humanResponse;
    console.log(`[HUMAN INPUT] Received response for goal ${goal.id}`);

    if (intervention.state === "WAITING_FOR_OTP" && humanResponse) {
      const otpInput = detectOTPInput(browserState.inputs || []);
      if (otpInput) {
        const otpPlan = createPlan(goal.id, [
          { type: "type", params: { element: otpInput.id, text: humanResponse } },
          { type: "press_key", params: { key: "Enter" } },
          { type: "read_ui", params: {} }
        ]);
        await executePlan(otpPlan).catch(err => console.error("[OTP] OTP plan execution failed:", err.message));
      }
    }

    const reReadPlan = { goalId: goal.id, actions: [{ type: "read_ui", params: {} }] };
    const reReadResult = await executePlan(reReadPlan).catch(() => null);
    const newObs = reReadResult?.observations?.[reReadResult.observations.length - 1];
    if (newObs) {
      updateWorldModel(goal, newObs);
      return newObs;
    }
    return latestObs;
  } catch (err) {
    console.log(`[HUMAN INPUT] Failed: ${err.message}`);
    return { escalation: err.message };
  }
}
