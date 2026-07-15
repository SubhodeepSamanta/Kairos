import { describe, it, expect } from "vitest";
import { formatSnapshot, describePageChange } from "../../src/agent/snapshot.js";

describe("formatSnapshot", () => {
  it("says no page when empty", () => {
    expect(formatSnapshot(null)).toContain("no page loaded");
    expect(formatSnapshot({})).toContain("no page loaded");
  });

  it("includes every input even when there are many", () => {
    const inputs = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, ariaRole: "textbox", text: `field ${i + 1}` }));
    const out = formatSnapshot({ url: "https://x.com", title: "X", inputs, buttons: [], links: [], text: "" });
    for (let i = 1; i <= 45; i++) {
      expect(out).toContain(`[${i}]`);
    }
    expect(out).toContain("INPUTS (45)");
  });

  it("dedupes buttons with identical labels", () => {
    const buttons = [
      { id: 1, text: "Like" },
      { id: 2, text: "Like" },
      { id: 3, text: "Share" }
    ];
    const out = formatSnapshot({ url: "u", title: "t", inputs: [], buttons, links: [], text: "" });
    expect(out).toContain("[1]");
    expect(out).not.toContain("[2]");
    expect(out).toContain("[3]");
  });

  it("caps links with a note but keeps the true count", () => {
    const links = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, text: `link ${i + 1}`, href: `/l${i}` }));
    const out = formatSnapshot({ url: "u", title: "t", inputs: [], buttons: [], links, text: "" });
    expect(out).toContain("LINKS (250, showing 35 most relevant");
    expect(out).toContain("[35]");
    expect(out).not.toContain("[36]");
  });

  it("shows tabs and truncates page text", () => {
    const out = formatSnapshot({
      url: "u", title: "t", inputs: [], buttons: [], links: [],
      tabs: [{ index: 0, title: "One", active: true }, { index: 1, title: "Two", active: false }],
      text: "x".repeat(3000)
    });
    expect(out).toContain("TABS: [0*] One | [1] Two");
    expect(out).toContain("…");
    expect(out.length).toBeLessThan(2000);
  });

  it("shows input values and disabled state", () => {
    const out = formatSnapshot({
      url: "u", title: "t",
      inputs: [{ id: 7, ariaRole: "searchbox", text: "Search", value: "lofi" }],
      buttons: [{ id: 9, text: "Go", disabled: true }],
      links: [], text: ""
    });
    expect(out).toContain('[7] searchbox "Search" value="lofi"');
    expect(out).toContain('[9] "Go" (disabled)');
  });
});

describe("describePageChange", () => {
  it("reports where we landed after a url change", () => {
    expect(describePageChange({ url: "a", title: "t" }, { url: "b", title: "t" })).toBe('now on b "t"');
  });

  it("always names the current page even when nothing changed", () => {
    expect(describePageChange({ url: "a", title: "t" }, { url: "a", title: "t" })).toBe('still on a "t"');
  });

  it("never says a navigation to the current page did not change", () => {
    const out = describePageChange(
      { url: "https://github.com", title: "GitHub" },
      { url: "https://github.com", title: "GitHub" }
    );
    expect(out).toContain("https://github.com");
    expect(out).not.toContain("did not change");
  });

  it("reports title-only changes without losing the url", () => {
    const out = describePageChange({ url: "a", title: "old" }, { url: "a", title: "new" });
    expect(out).toContain("a");
    expect(out).toContain("new");
  });

  it("handles first observation", () => {
    expect(describePageChange(null, { url: "a" })).toContain("now on a");
  });

  it("handles a missing observation", () => {
    expect(describePageChange({ url: "a" }, null)).toBe("no observation");
  });
});
