import { describe, it, expect, beforeEach } from "vitest";
import { clearRegistry, registerElement, getElement, getElementBox, getElementInfo, hasElement } from "../../../../src/automation/browser/elements/registry.js";

describe("registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("stores and retrieves an element by integer ID", () => {
    const locator = { click: () => {} };
    registerElement(42, locator, "hello", "button", { top: 10, left: 20, width: 100, height: 50 });
    expect(getElement(42)).toBe(locator);
    expect(getElement("42")).toBe(locator);
  });

  it("stores and retrieves an element by string ID", () => {
    const locator = { click: () => {} };
    registerElement("99", locator, "world", "link", null);
    expect(getElement(99)).toBe(locator);
    expect(getElement("99")).toBe(locator);
  });

  it("returns null for unknown element", () => {
    expect(getElement(999)).toBeNull();
    expect(getElementBox(999)).toBeNull();
    expect(hasElement(999)).toBe(false);
  });

  it("getElementInfo returns full entry", () => {
    registerElement(1, "loc", "text", "button", { top: 0, left: 0, width: 10, height: 10 });
    const info = getElementInfo(1);
    expect(info.text).toBe("text");
    expect(info.role).toBe("button");
    expect(info.box.top).toBe(0);
  });

  it("clearRegistry empties all entries", () => {
    registerElement(1, "a", "x", "button", null);
    registerElement(2, "b", "y", "link", null);
    clearRegistry();
    expect(hasElement(1)).toBe(false);
    expect(hasElement(2)).toBe(false);
  });
});
