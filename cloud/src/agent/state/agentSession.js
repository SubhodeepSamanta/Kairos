import fs from "fs";
import path from "path";

export function saveAgentSession(goal, tracker, context, stateType, transition = null) {
  const session = {
    goalId: goal.id,
    goalObjective: goal.objective,
    tracker,
    context,
    stateType,
    transition,
    savedAt: new Date().toISOString()
  };
  const sessionDir = path.join(process.cwd(), "sessions");
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  const filePath = path.join(sessionDir, `session_${goal.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf8");
  console.log(`[HUMAN LOOP] Persisted session to ${filePath}`);
}

export function loadAgentSession(goalId) {
  const filePath = path.join(process.cwd(), "sessions", `session_${goalId}.json`);
  if (fs.existsSync(filePath)) {
    console.log(`[HUMAN LOOP] Loaded persisted session from ${filePath}`);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  return null;
}

export function checkForHumanIntervention(browserState) {
  if (!browserState) return null;

  const pageText = (browserState.text || "").toLowerCase();
  const pageTitle = (browserState.title || "").toLowerCase();

  if (pageText.includes("captcha") || pageText.includes("verify you are human") || pageTitle.includes("captcha") || pageTitle.includes("security check")) {
    return {
      interventionNeeded: true,
      state: "WAITING_FOR_CAPTCHA",
      reason: "CAPTCHA detected. Please solve the CAPTCHA in the browser."
    };
  }

  if (pageText.includes("two-factor") || pageText.includes("enter verification code") || pageText.includes("sent a code") || pageText.includes("otp")) {
    return {
      interventionNeeded: true,
      state: "WAITING_FOR_OTP",
      reason: "Two-Factor Authentication / OTP requested. Please complete verification in the browser."
    };
  }

  if (pageTitle.includes("sign in") || pageTitle.includes("login") || pageText.includes("sign in to your account")) {
    return {
      running: false,
      interventionNeeded: true,
      state: "WAITING_FOR_LOGIN",
      reason: "Login wall detected. Please sign in to continue."
    };
  }

  if (pageText.includes("credit card details") || pageText.includes("checkout") || pageText.includes("billing info") || pageText.includes("pay now") || pageText.includes("cvv")) {
    return {
      interventionNeeded: true,
      state: "WAITING_FOR_PAYMENT",
      reason: "Checkout/Payment process detected. Requires payment credentials."
    };
  }

  if (pageText.includes("waiting for approval") || pageText.includes("pending administrator") || pageText.includes("approval email")) {
    return {
      interventionNeeded: true,
      state: "WAITING_FOR_EXTERNAL_EVENT",
      reason: "Action pending external approval or confirmation email."
    };
  }

  if (pageText.includes("permission requested") || pageText.includes("allow notification") || pageText.includes("use location")) {
    return {
      interventionNeeded: true,
      state: "WAITING_FOR_PERMISSION",
      reason: "Browser permission requested. Please accept or deny."
    };
  }

  if (pageText.includes("are you sure") || pageText.includes("confirm purchase") || pageText.includes("confirm action")) {
    return {
      running: false,
      interventionNeeded: true,
      state: "WAITING_FOR_CONFIRMATION",
      reason: "Confirmation dialog detected. Please confirm action to proceed."
    };
  }

  return null;
}
