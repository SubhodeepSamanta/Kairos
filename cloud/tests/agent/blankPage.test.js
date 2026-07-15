import { describe, it, expect } from "vitest";
import { formatSnapshot, describePageChange, isBlankPage } from "../../src/agent/snapshot.js";

const blank = { url: "about:blank", title: "", inputs: [], buttons: [], links: [], text: "" };

describe("blank tabs", () => {
  it("recognises the blank urls browsers actually use", () => {
    for (const url of [
      "about:blank",
      "chrome://new-tab-page/",
      "chrome://newtab/",
      "edge://newtab/",
      "brave://newtab/"
    ]) {
      expect(isBlankPage({ url, inputs: [], buttons: [], links: [] }), url).toBe(true);
    }
  });

  it("is not fooled by a real page", () => {
    expect(isBlankPage({ url: "https://github.com", buttons: [{ id: 1, text: "Sign in" }] })).toBe(false);
  });

  it("treats a new-tab page that has real content as a real page", () => {
    expect(isBlankPage({ url: "chrome://new-tab-page/", links: [{ id: 1, text: "Shortcut" }] })).toBe(false);
  });

  it("never tells the model to wait on a blank tab", () => {
    const out = formatSnapshot(blank);
    expect(out).not.toMatch(/still be loading/i);
    expect(out).not.toMatch(/try wait/i);
    expect(out).not.toMatch(/try wait then read, or scroll/i);
  });

  it("tells it plainly to navigate", () => {
    const out = formatSnapshot(blank);
    expect(out).toContain("empty tab");
    expect(out).toContain("navigate");
    expect(out).toContain("nothing will load on its own");
  });

  it("says so in the page-change line too", () => {
    const out = describePageChange({ url: "https://github.com", title: "GitHub" }, blank);
    expect(out).toContain("empty tab");
    expect(out).toContain("navigate");
  });

  it("still suggests waiting on a real page that is genuinely empty", () => {
    const out = formatSnapshot({ url: "https://slow.example", title: "Slow", inputs: [], buttons: [], links: [], text: "" });
    expect(out).toMatch(/still be loading/i);
  });

  it("says text-only rather than loading when a page has prose but no controls", () => {
    const out = formatSnapshot({ url: "https://docs.example", title: "Docs", inputs: [], buttons: [], links: [], text: "some documentation" });
    expect(out).toContain("text only");
    expect(out).not.toMatch(/still be loading/i);
  });
});
