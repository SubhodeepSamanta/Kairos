import { describe, it, expect } from "vitest";
import { toSendKeys } from "../../src/automation/desktop/windows/keys.js";

describe("toSendKeys", () => {
  it("maps a ctrl chord to a SendKeys modifier", () => {
    expect(toSendKeys("Ctrl+S")).toBe("^s");
    expect(toSendKeys("ctrl+c")).toBe("^c");
  });

  it("braces function and named keys", () => {
    expect(toSendKeys("Alt+F4")).toBe("%{F4}");
    expect(toSendKeys("Enter")).toBe("{ENTER}");
    expect(toSendKeys("Escape")).toBe("{ESC}");
    expect(toSendKeys("Delete")).toBe("{DEL}");
  });

  it("stacks multiple modifiers in order", () => {
    expect(toSendKeys("Ctrl+Shift+Delete")).toBe("^+{DEL}");
  });

  it("escapes SendKeys metacharacters used as a literal key", () => {
    expect(toSendKeys("Ctrl+^")).toBe("^{^}");
  });

  it("drops the windows key (SendKeys cannot send it)", () => {
    expect(toSendKeys("Win+D")).toBe("d");
  });

  it("is empty for empty input", () => {
    expect(toSendKeys("")).toBe("");
    expect(toSendKeys("   ")).toBe("");
  });
});
