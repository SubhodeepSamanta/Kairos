import fs from "fs";
import path from "path";

export function saveAgentSession(goal, tracker, context, stateType, transition = null, workflowMemory = null) {
  const session = {
    goalId: goal.id,
    goalObjective: goal.objective,
    tracker,
    context,
    stateType,
    transition,
    workflowMemory,
    findings: goal.world?.findings || [],
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

export function checkForHumanIntervention(browserState, pageUnderstanding = null, bestCandidate = null) {
  if (!browserState) return null;

  const pageText = (browserState.text || "").toLowerCase();
  const pageTitle = (browserState.title || "").toLowerCase();

  // 1. CAPTCHA / Human verification / MFA check
  const titleSignalsCaptcha = pageTitle.includes("captcha") || pageTitle.includes("security check") || pageTitle.includes("verify you are human");
  const bodySignalsCaptcha = pageText.includes("captcha") || pageText.includes("verify you are human");
  const hasMinimalInteractiveContent = (browserState.inputs || []).length <= 2 &&
                                        (browserState.links || []).length === 0 &&
                                        (browserState.buttons || []).length <= 2;
  if (titleSignalsCaptcha || (bodySignalsCaptcha && hasMinimalInteractiveContent)) {
    return {
      interventionNeeded: true,
      state: "WAITING_FOR_CAPTCHA",
      reason: "CAPTCHA/Security check detected. Solver required."
    };
  }

  if (pageText.includes("two-factor") || pageText.includes("enter verification code") || pageText.includes("sent a code") || pageText.includes("otp")) {
    return {
      running: false,
      interventionNeeded: true,
      state: "WAITING_FOR_OTP",
      reason: "Two-Factor Authentication / OTP requested. Input required."
    };
  }

  // 2. Dangerous/financial actions check
  if (pageUnderstanding && pageUnderstanding.risks?.some(r => r.type === "payment_action")) {
    return {
      interventionNeeded: true,
      state: "WAITING_FOR_PAYMENT_APPROVAL",
      reason: "Payment checkout or financial billing details detected. User approval required before proceeding."
    };
  }

  if (pageUnderstanding && pageUnderstanding.risks?.some(r => r.type === "destructive_action")) {
    return {
      running: false,
      interventionNeeded: true,
      state: "WAITING_FOR_DELETION_APPROVAL",
      reason: "Destructive deletion or cancellation action detected. User confirmation required."
    };
  }

  // 3. Conflicting choices or low score check
  if (bestCandidate && bestCandidate.score < 25) {
    return {
      running: false,
      interventionNeeded: true,
      state: "WAITING_FOR_CLARIFICATION",
      reason: `Low action confidence score (${bestCandidate.score}). Insufficient information or multiple equally valid paths. Please clarify.`
    };
  }

  return null;
}
