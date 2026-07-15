import { describe, it, expect, beforeEach } from "vitest";
import {
  storeCredential, getCredential, clearCredentials,
  detectOTPInput, detectCaptchaProvider, checkForHumanIntervention
} from "../../../src/agent/state/agentSession.js";

describe("credentialStore", () => {
  beforeEach(() => {
    clearCredentials();
  });

  it("stores and retrieves credentials by domain", () => {
    storeCredential("example.com", { username: "user1", password: "pass1" });
    const cred = getCredential("example.com");
    expect(cred.username).toBe("user1");
    expect(cred.password).toBe("pass1");
    expect(cred.storedAt).toBeTypeOf("number");
  });

  it("returns most recent credential per domain", () => {
    storeCredential("example.com", { username: "old" });
    storeCredential("example.com", { username: "new" });
    expect(getCredential("example.com").username).toBe("new");
  });

  it("returns null for unknown domain", () => {
    expect(getCredential("unknown.com")).toBeNull();
  });

  it("clearCredentials empties all stores", () => {
    storeCredential("a.com", { u: "a" });
    storeCredential("b.com", { u: "b" });
    clearCredentials();
    expect(getCredential("a.com")).toBeNull();
    expect(getCredential("b.com")).toBeNull();
  });
});

describe("detectOTPInput", () => {
  it("detects input with 'code' in label", () => {
    const input = { text: "Enter code", placeholder: "" };
    expect(detectOTPInput([input])).toBe(input);
  });

  it("detects input with 'otp' in name", () => {
    const input = { name: "otp-field" };
    expect(detectOTPInput([input])).toBe(input);
  });

  it("detects input with 'verification' in placeholder", () => {
    const input = { placeholder: "verification code" };
    expect(detectOTPInput([input])).toBe(input);
  });

  it("detects input with '2fa' in text", () => {
    const input = { text: "2fa code" };
    expect(detectOTPInput([input])).toBe(input);
  });

  it("returns undefined when no OTP input found", () => {
    const inputs = [{ text: "username" }, { text: "password" }];
    expect(detectOTPInput(inputs)).toBeUndefined();
  });

  it("returns undefined for empty or null inputs", () => {
    expect(detectOTPInput([])).toBeUndefined();
    expect(detectOTPInput(null)).toBeUndefined();
  });
});

describe("detectCaptchaProvider", () => {
  it("detects Cloudflare Turnstile", () => {
    expect(detectCaptchaProvider("cf-turnstile widget", "", [], [], [])).toBe("cloudflare_turnstile");
  });

  it("detects hCaptcha", () => {
    expect(detectCaptchaProvider("h-captcha", "", [], [], [])).toBe("hcaptcha");
  });

  it("detects reCAPTCHA", () => {
    expect(detectCaptchaProvider("g-recaptcha", "", [], [], [])).toBe("recaptcha");
  });

  it("returns null when no CAPTCHA provider detected", () => {
    expect(detectCaptchaProvider("normal page", "", [], [], [])).toBeNull();
  });
});

describe("checkForHumanIntervention", () => {
  it("returns null for null browserState", () => {
    expect(checkForHumanIntervention(null)).toBeNull();
  });

  it("detects CAPTCHA from page title", () => {
    const state = { title: "Security Check - Verify", text: "some text", inputs: [], links: [], buttons: [] };
    const result = checkForHumanIntervention(state);
    expect(result.interventionNeeded).toBe(true);
    expect(result.state).toBe("WAITING_FOR_CAPTCHA");
  });

  it("detects CAPTCHA from body text with minimal interactive content", () => {
    const state = { title: "page", text: "please verify you are human captcha", inputs: [{ id: 1 }], links: [], buttons: [{ id: 2 }] };
    const result = checkForHumanIntervention(state);
    expect(result.interventionNeeded).toBe(true);
    expect(result.state).toBe("WAITING_FOR_CAPTCHA");
  });

  it("detects OTP from page text", () => {
    const state = { title: "page", text: "enter verification code sent to your phone", inputs: [], links: [], buttons: [] };
    const result = checkForHumanIntervention(state);
    expect(result.interventionNeeded).toBe(true);
    expect(result.state).toBe("WAITING_FOR_OTP");
  });

  it("detects payment risk intervention", () => {
    const state = { title: "checkout", text: "pay", inputs: [], links: [], buttons: [] };
    const pageUnderstanding = { risks: [{ type: "payment_action" }] };
    const result = checkForHumanIntervention(state, pageUnderstanding);
    expect(result.interventionNeeded).toBe(true);
    expect(result.state).toBe("WAITING_FOR_PAYMENT_APPROVAL");
  });

  it("detects destructive action intervention", () => {
    const state = { title: "delete", text: "confirm deletion", inputs: [], links: [], buttons: [] };
    const pageUnderstanding = { risks: [{ type: "destructive_action" }] };
    const result = checkForHumanIntervention(state, pageUnderstanding);
    expect(result.interventionNeeded).toBe(true);
    expect(result.state).toBe("WAITING_FOR_DELETION_APPROVAL");
  });

  it("detects low confidence intervention", () => {
    const state = { title: "page", text: "content", inputs: [], links: [], buttons: [] };
    const result = checkForHumanIntervention(state, null, { score: 20 });
    expect(result.interventionNeeded).toBe(true);
    expect(result.state).toBe("WAITING_FOR_CLARIFICATION");
  });

  it("returns null when no intervention needed", () => {
    const state = { title: "normal", text: "normal page content", inputs: [{ id: 1 }, { id: 2 }], links: [{ id: 3 }], buttons: [{ id: 4 }] };
    expect(checkForHumanIntervention(state)).toBeNull();
  });
});
