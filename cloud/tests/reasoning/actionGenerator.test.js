import { describe, it, expect } from "vitest";
import { generateActions } from "../../src/reasoning/actionGenerator.js";

function makeElement(overrides) {
  return {
    id: overrides.id || 1,
    text: overrides.text || "test",
    role: overrides.role || "button",
    ariaRole: overrides.ariaRole || "button",
    visible: true,
    enabled: true,
    actionHints: overrides.actionHints || ["click"],
    semanticType: overrides.semanticType || "action_target",
    purpose: overrides.purpose || "action_target",
    label: overrides.label || null,
    href: overrides.href || null,
    ...overrides
  };
}

function makePageUnderstanding(overrides = {}) {
  return {
    pagePurpose: overrides.pagePurpose || "generic",
    importantElements: overrides.importantElements || [],
    availableActions: overrides.availableActions || [],
    constraints: overrides.constraints || [],
    risks: overrides.risks || [],
    resolvedState: overrides.resolvedState || null,
    ...overrides
  };
}

describe("generateActions — tab management", () => {
  it("generates switch_tab candidates when multiple tabs exist", () => {
    const goal = "find content on another tab";
    const pageUnderstanding = makePageUnderstanding();
    const browserState = {
      url: "https://example.com",
      title: "Page 1",
      inputs: [],
      buttons: [],
      links: [],
      tabs: [
        { index: 0, title: "Page 1", url: "https://example.com", active: true },
        { index: 1, title: "Page 2", url: "https://other.com", active: false }
      ]
    };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    const switchCandidates = candidates.filter(c => c.type === "switch_tab");
    expect(switchCandidates.length).toBeGreaterThanOrEqual(1);
    expect(switchCandidates[0].tabIndex).toBe(1);
  });

  it("generates close_tab candidate when multiple tabs exist", () => {
    const goal = "close this tab";
    const pageUnderstanding = makePageUnderstanding();
    const browserState = {
      url: "https://example.com",
      title: "Page 1",
      inputs: [],
      buttons: [],
      links: [],
      tabs: [
        { index: 0, title: "Page 1", url: "https://example.com", active: true },
        { index: 1, title: "Page 2", url: "https://other.com", active: false }
      ]
    };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    const closeCandidates = candidates.filter(c => c.type === "close_tab");
    expect(closeCandidates).toHaveLength(1);
  });

  it("always generates new_tab candidate", () => {
    const goal = "open new tab";
    const pageUnderstanding = makePageUnderstanding();
    const browserState = { url: "https://example.com", title: "", inputs: [], buttons: [], links: [] };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    const newTabCandidates = candidates.filter(c => c.type === "new_tab");
    expect(newTabCandidates).toHaveLength(1);
  });
});

describe("generateActions — login flow", () => {
  it("generates login candidate for access_control pages without credentials", () => {
    const goal = "log in to site";
    const pageUnderstanding = makePageUnderstanding({ pagePurpose: "access_control" });
    const browserState = {
      url: "https://example.com/login",
      title: "Sign In",
      inputs: [{ id: 1, text: "username" }, { id: 2, text: "password" }],
      buttons: [{ id: 3, text: "Sign In" }],
      links: [],
      pagePurpose: "access_control"
    };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    const loginCandidates = candidates.filter(c => c.type === "login");
    expect(loginCandidates).toHaveLength(1);
    expect(loginCandidates[0].actions[0].type).toBe("human_input");
  });

  it("does not generate login candidate when inputs already have values", () => {
    const goal = "log in";
    const pageUnderstanding = makePageUnderstanding({ pagePurpose: "access_control" });
    const browserState = {
      url: "https://example.com/login",
      title: "Sign In",
      inputs: [{ id: 1, text: "username", value: "user1" }, { id: 2, text: "password", value: "pass1" }],
      buttons: [{ id: 3, text: "Sign In" }],
      links: [],
      pagePurpose: "access_control"
    };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    const loginCandidates = candidates.filter(c => c.type === "login");
    expect(loginCandidates).toHaveLength(0);
  });

  it("does not generate login candidate for non-access_control pages", () => {
    const goal = "browse site";
    const pageUnderstanding = makePageUnderstanding({ pagePurpose: "content_viewing" });
    const browserState = {
      url: "https://example.com",
      title: "Home",
      inputs: [],
      buttons: [],
      links: [],
      pagePurpose: "content_viewing"
    };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    const loginCandidates = candidates.filter(c => c.type === "login");
    expect(loginCandidates).toHaveLength(0);
  });
});

describe("generateActions — core actions", () => {
  it("includes scroll, back, and read_ui candidates", () => {
    const goal = "test";
    const pageUnderstanding = makePageUnderstanding();
    const browserState = { url: "https://example.com", title: "", inputs: [], buttons: [], links: [] };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    expect(candidates.some(c => c.type === "scroll")).toBe(true);
    expect(candidates.some(c => c.type === "back")).toBe(true);
    expect(candidates.some(c => c.type === "read_ui")).toBe(true);
  });

  it("generates navigate candidate for blank pages", () => {
    const goal = "search for something";
    const pageUnderstanding = makePageUnderstanding();
    const browserState = { url: "about:blank", title: "", inputs: [], buttons: [], links: [] };
    const candidates = generateActions(goal, pageUnderstanding, browserState);
    expect(candidates.some(c => c.type === "navigate")).toBe(true);
  });
});
