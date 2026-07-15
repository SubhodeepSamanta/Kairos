import { describe, it, expect } from "vitest";
import { understandPage } from "../../src/world/pageUnderstandingV2.js";

describe("understandPage", () => {
  it("returns generic purpose for empty browser state", () => {
    const result = understandPage({});
    expect(result.pagePurpose).toBe("generic");
    expect(result.importantElements).toEqual([]);
    expect(result.availableActions).toEqual([]);
  });

  it("detects search workflow from inputs and links", () => {
    const browser = {
      url: "https://example.com",
      title: "Search",
      text: "search results find something",
      inputs: [
        { id: 1, text: "search", role: "searchbox", ariaRole: "searchbox", semanticType: "search_input", purpose: "search_input", visible: true, enabled: true }
      ],
      buttons: [
        { id: 2, text: "Search", role: "button", ariaRole: "button", semanticType: "action_target", purpose: "action_target", visible: true, enabled: true }
      ],
      links: [
        { id: 3, text: "Result 1", role: "link", ariaRole: "link", semanticType: "primary_content", purpose: "primary_content", visible: true, enabled: true, href: "/item/1" }
      ]
    };
    const result = understandPage(browser);
    expect(result.pagePurpose).not.toBe("generic");
    expect(result.importantElements.length).toBeGreaterThan(0);
  });

  it("detects access_control from password input", () => {
    const browser = {
      url: "https://example.com/login",
      title: "Sign In",
      text: "sign in to your account",
      inputs: [
        { id: 1, text: "Email", role: "input", ariaRole: "textbox", visible: true, enabled: true },
        { id: 2, text: "Password", role: "input", ariaRole: "textbox", type: "password", visible: true, enabled: true }
      ],
      buttons: [
        { id: 3, text: "Sign In", role: "button", ariaRole: "button", visible: true, enabled: true }
      ]
    };
    const result = understandPage(browser);
    expect(result.pagePurpose).toBe("access_control");
    expect(result.constraints.some(c => c.type === "access_control_required")).toBe(true);
  });

  it("generates available action hints for interactive elements", () => {
    const browser = {
      url: "https://example.com",
      title: "Test",
      inputs: [
        { id: 1, text: "search", role: "searchbox", ariaRole: "searchbox", semanticType: "search_input", purpose: "search_input", visible: true, enabled: true }
      ],
      buttons: [
        { id: 2, text: "Go", role: "button", ariaRole: "button", semanticType: "action_target", purpose: "action_target", visible: true, enabled: true }
      ],
      links: [
        { id: 3, text: "Home", role: "link", ariaRole: "link", semanticType: "navigation_element", purpose: "navigation_target", visible: true, enabled: true, href: "/" }
      ]
    };
    const result = understandPage(browser);
    expect(result.availableActions.length).toBeGreaterThanOrEqual(3);
    expect(result.availableActions.some(a => a.startsWith("click:"))).toBe(true);
    expect(result.availableActions.some(a => a.startsWith("type:"))).toBe(true);
    expect(result.availableActions.some(a => a.startsWith("navigate:"))).toBe(true);
  });
});
