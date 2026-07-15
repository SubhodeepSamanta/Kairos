import { describe, it, expect } from "vitest";
import { parseAriaSnapshot } from "../../../src/automation/browser/actions/observation/ariaReader.js";

describe("parseAriaSnapshot", () => {
  it("parses roles and names", () => {
    const nodes = parseAriaSnapshot(`
- button "Go"
- textbox "Search"
- link "Home"
`);
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ role: "button", name: "Go" });
    expect(nodes[1]).toMatchObject({ role: "textbox", name: "Search" });
  });

  it("keeps only interactive roles", () => {
    const nodes = parseAriaSnapshot(`
- heading "Title"
- paragraph
- button "Click"
- banner
- img "logo"
`);
    expect(nodes.map(n => n.role)).toEqual(["button"]);
  });

  it("reads disabled and checked flags", () => {
    const nodes = parseAriaSnapshot(`
- button "Off" [disabled]
- checkbox "Agree" [checked]
`);
    expect(nodes[0].disabled).toBe(true);
    expect(nodes[1].checked).toBe(true);
    expect(nodes[0].checked).toBe(false);
  });

  it("handles nesting and indentation", () => {
    const nodes = parseAriaSnapshot(`
- banner:
  - link "Home":
    - /url: /
  - button "Menu"
- main:
  - textbox "Query"
`);
    expect(nodes.map(n => n.name)).toEqual(["Home", "Menu", "Query"]);
  });

  it("handles escaped quotes in names", () => {
    const nodes = parseAriaSnapshot(`- button "Say \\"hi\\""`);
    expect(nodes[0].name).toBe('Say "hi"');
  });

  it("ignores url metadata lines", () => {
    const nodes = parseAriaSnapshot(`
- link "Docs":
  - /url: https://example.com/docs
`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].value).toBe("");
  });

  it("returns empty for junk input", () => {
    expect(parseAriaSnapshot("")).toEqual([]);
    expect(parseAriaSnapshot(null)).toEqual([]);
    expect(parseAriaSnapshot("not yaml at all")).toEqual([]);
  });

  it("finds elements on a realistic snapshot", () => {
    const nodes = parseAriaSnapshot(`
- banner:
  - link "Skip to content"
  - combobox "Search or jump to…"
  - button "Sign in"
- main:
  - heading "Build software"
  - textbox "Email address"
  - button "Sign up for GitHub" [disabled]
  - link "Pricing"
`);
    expect(nodes.map(n => n.role)).toEqual(["link", "combobox", "button", "textbox", "button", "link"]);
    expect(nodes.find(n => n.name === "Sign up for GitHub").disabled).toBe(true);
  });
});
