import fs from "fs";
import path from "path";

const credentialStore = new Map();

export function saveAgentSession(goal, tracker, context, stateType, transition = null, workflowMemory = null, extra = {}) {
  const session = {
    goalId: goal.id,
    goalObjective: goal.objective,
    tracker,
    context,
    stateType,
    transition,
    workflowMemory,
    world: goal.world || {},
    humanInputPrompt: extra.humanInputPrompt || null,
    humanInputResponseType: extra.humanInputResponseType || null,
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

export function storeCredential(domain, credential) {
  const existing = credentialStore.get(domain) || [];
  existing.push({ ...credential, storedAt: Date.now() });
  credentialStore.set(domain, existing);
}

export function getCredential(domain) {
  const entries = credentialStore.get(domain);
  if (!entries || entries.length === 0) return null;
  return entries[entries.length - 1];
}

export function clearCredentials() {
  credentialStore.clear();
}

export function checkForHumanIntervention(browserState, pageUnderstanding = null, bestCandidate = null) {
  if (!browserState) return null;

  const pageText = (browserState.text || "").toLowerCase();
  const pageTitle = (browserState.title || "").toLowerCase();

  const titleSignalsCaptcha = pageTitle.includes("captcha") || pageTitle.includes("security check") || pageTitle.includes("verify you are human");
  const bodySignalsCaptcha = pageText.includes("captcha") || pageText.includes("verify you are human");
  const hasMinimalInteractiveContent = (browserState.inputs || []).length <= 2 &&
                                        (browserState.links || []).length === 0 &&
                                        (browserState.buttons || []).length <= 2;
  if (titleSignalsCaptcha || (bodySignalsCaptcha && hasMinimalInteractiveContent)) {
    return { interventionNeeded: true, state: "WAITING_FOR_CAPTCHA", reason: "CAPTCHA/Security check detected. Solver required." };
  }

  if (pageText.includes("two-factor") || pageText.includes("enter verification code") || pageText.includes("sent a code") || pageText.includes("otp")) {
    return { running: false, interventionNeeded: true, state: "WAITING_FOR_OTP", reason: "Two-Factor Authentication / OTP requested. Input required." };
  }

  if (pageUnderstanding && pageUnderstanding.risks?.some(r => r.type === "payment_action")) {
    return { interventionNeeded: true, state: "WAITING_FOR_PAYMENT_APPROVAL", reason: "Payment checkout or financial billing details detected. User approval required before proceeding." };
  }

  if (pageUnderstanding && pageUnderstanding.risks?.some(r => r.type === "destructive_action")) {
    return { running: false, interventionNeeded: true, state: "WAITING_FOR_DELETION_APPROVAL", reason: "Destructive deletion or cancellation action detected. User confirmation required." };
  }

  if (bestCandidate && bestCandidate.score < 25) {
    return { running: false, interventionNeeded: true, state: "WAITING_FOR_CLARIFICATION", reason: `Low action confidence score (${bestCandidate.score}). Insufficient information or multiple equally valid paths. Please clarify.` };
  }

  return null;
}

export function detectOTPInput(inputs) {
  return (inputs || []).find(inp => {
    const text = (inp.text || inp.placeholder || inp.name || "").toLowerCase();
    return text.includes("code") || text.includes("otp") || text.includes("verification") || text.includes("2fa");
  });
}

export function detectCaptchaProvider(pageText, pageTitle, inputs, buttons, links) {
  const combined = (pageText + " " + pageTitle).toLowerCase();
  if (combined.includes("cf-turnstile") || combined.includes("cloudflare")) return "cloudflare_turnstile";
  if (combined.includes("h-captcha") || combined.includes("hcaptcha")) return "hcaptcha";
  if (combined.includes("recaptcha") || combined.includes("reCAPTCHA") || combined.includes("g-recaptcha")) return "recaptcha";
  return null;
}
