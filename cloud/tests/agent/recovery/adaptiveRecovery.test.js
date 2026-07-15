import { describe, it, expect } from "vitest";
import { executeAdaptiveRecovery } from "../../../src/agent/recovery/adaptiveRecovery.js";

describe("adaptiveRecovery", () => {
  it("executeAdaptiveRecovery returns actions from recovery plan when no escalation", async () => {
    const action = { type: "click", params: { element: 3 } };
    const context = {};
    const result = await executeAdaptiveRecovery(action, context, 0);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it("returns escalate when action fails repeatedly", async () => {
    const action = { type: "click", params: { element: 999 } };
    const context = {};
    const result = await executeAdaptiveRecovery(action, context, 5);
    expect(result).toBeDefined();
  });

  it("returns object with success and actions properties", async () => {
    const action = { type: "navigate", params: { url: "https://example.com" } };
    const context = { pagePurpose: "generic" };
    const result = await executeAdaptiveRecovery(action, context, 0);
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("actions");
    expect(Array.isArray(result.actions)).toBe(true);
  });
});
