import { describe, it, expect } from "vitest";
import { diagnose } from "../../../src/agent/recovery/diagnoser.js";

describe("diagnose", () => {
  it("returns page load failure for null browserState", () => {
    const result = diagnose(null, null);
    expect(result.type).toBe("page load failure");
    expect(result.alternative).toBeDefined();
  });

  it("detects CAPTCHA / human verification", () => {
    const browserState = {
      url: "https://example.com",
      title: "Verify",
      text: "Please verify you are human captcha",
      inputs: [],
      buttons: [],
      links: []
    };
    const result = diagnose(null, browserState);
    expect(result.type).toBe("authentication required");
    expect(result.escalate).toBe("human_loop");
    expect(result.requiresHumanInput).toBe(true);
  });

  it("detects rate limiting", () => {
    const browserState = {
      url: "https://example.com",
      title: "Error",
      text: "rate limit exceeded 429",
      inputs: [],
      buttons: [],
      links: []
    };
    const result = diagnose(null, browserState);
    expect(result.type).toBe("rate limit");
    expect(result.alternative).toBeDefined();
  });

  it("detects cookie consent modal blocking", () => {
    const browserState = {
      url: "https://example.com",
      title: "Site",
      text: "cookie consent privacy agree",
      inputs: [],
      buttons: [{ id: 1, text: "Accept All", purpose: "confirmation_action" }],
      links: []
    };
    const result = diagnose(null, browserState, null, 0);
    expect(result.type).toBe("blocked modal");
    expect(result.alternative[0].type).toBe("click");
    expect(result.alternative[0].params.element).toBe(1);
  });

  it("detects blank page", () => {
    const browserState = { url: "about:blank", title: "", inputs: [], buttons: [], links: [] };
    const result = diagnose(null, browserState);
    expect(result.type).toBe("page load failure");
    expect(result.alternative[0].type).toBe("navigate");
  });

  it("detects missing element with tab search when multiple tabs", () => {
    const browserState = {
      url: "https://example.com",
      title: "Tab 1",
      text: "content",
      inputs: [{ id: 1, text: "search" }],
      buttons: [],
      links: [],
      tabs: [
        { index: 0, active: true },
        { index: 1, active: false }
      ]
    };
    const lastAction = { type: "click", params: { element: 999 } };
    const result = diagnose(lastAction, browserState);
    expect(result.type).toBe("missing element on tab");
    expect(result.alternative.some(a => a.type === "switch_tab")).toBe(true);
  });

  it("detects dead end with tab search when multiple tabs", () => {
    const browserState = {
      url: "https://example.com",
      title: "Empty",
      text: "",
      inputs: [],
      buttons: [],
      links: [],
      tabs: [
        { index: 0, active: true },
        { index: 1, active: false }
      ]
    };
    const result = diagnose(null, browserState);
    expect(result.type).toBe("dead end — try other tabs");
    expect(result.alternative.some(a => a.type === "switch_tab")).toBe(true);
  });

  it("detects no progress after multiple retries", () => {
    const browserState = {
      url: "https://example.com",
      title: "Same Page",
      text: "content",
      inputs: [{ id: 1, text: "input", visible: true }],
      buttons: [],
      links: []
    };
    const previousState = { url: "https://example.com", title: "same page" };
    const result = diagnose({ type: "click", params: { element: 1 } }, browserState, previousState, 2);
    expect(result.type).toBe("no progress");
  });

  it("returns stale content as fallback", () => {
    const browserState = {
      url: "https://example.com",
      title: "Page",
      text: "normal content",
      inputs: [{ id: 1, visible: true }],
      buttons: [],
      links: []
    };
    const result = diagnose({ type: "read_ui" }, browserState);
    expect(result.type).toBe("stale content");
    expect(result.alternative[0].type).toBe("read_ui");
  });
});
