import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.HUMANIZE = "false";

const fakeSelectLocator = {
  selectOption: vi.fn(),
  scrollIntoViewIfNeeded: async () => {},
  boundingBox: async () => ({ x: 10, y: 100, width: 120, height: 30 }),
  click: vi.fn(async () => {}),
  isVisible: async () => true,
  isEnabled: async () => true
};

const fakeOptionLocator = { click: vi.fn(async () => {}) };

const fakePage = {
  elements: [],
  url: () => "https://fake.test/form",
  title: async () => "Fake Form",
  evaluate: async () => 800,
  keyboard: { press: vi.fn(async () => {}) },
  locator: () => ({ first: () => fakeOptionLocator, nth: () => fakeSelectLocator, count: async () => 0 }),
  getByRole: (role, opts) => makeAriaLocator(role, opts?.name)
};

function makeAriaLocator(role, name) {
  return {
    nth: () => makeAriaLocator(role, name),
    isVisible: async () => true,
    isEnabled: async () => true,
    boundingBox: async () => ({ x: 10, y: 100, width: 120, height: 30 }),
    ariaSnapshot: async () => fakePage.elements.map(e => `- ${e.role} "${e.name}"`).join("\n")
  };
}

vi.mock("../../../../src/automation/browser/browser.js", () => ({
  getPage: async () => fakePage,
  listTabs: async () => [],
  browserDescription: () => "a throwaway browser (no logins)"
}));
vi.mock("../../../../src/automation/browser/actions/observation/pageReader.js", () => ({
  extractPageText: async () => ""
}));
vi.mock("../../../../src/automation/browser/actions/observation/buttonReader.js", () => ({ readButtons: async () => [] }));
vi.mock("../../../../src/automation/browser/actions/observation/inputReader.js", () => ({ readInputs: async () => [] }));
vi.mock("../../../../src/automation/browser/actions/observation/linkReader.js", () => ({ readLinks: async () => [] }));
vi.mock("../../../../src/automation/browser/actions/observation/selectReader.js", () => ({
  readSelects: async () => [
    {
      index: 0,
      text: "Country",
      value: "India",
      options: ["India", "Japan", "Brazil"],
      totalOptions: 3,
      visible: true,
      top: 100,
      left: 10,
      locator: fakeSelectLocator
    }
  ]
}));

const { readPage } = await import("../../../../src/automation/browser/actions/observation/read.js");
const { selectOption } = await import("../../../../src/automation/browser/actions/input/selectOption.js");
const { getElement } = await import("../../../../src/automation/browser/elements/registry.js");

beforeEach(() => {
  fakePage.elements = [];
  fakeSelectLocator.selectOption.mockReset();
  fakeSelectLocator.click.mockClear();
  fakeOptionLocator.click.mockClear();
});

describe("readPage select support", () => {
  it("merges native select options into the matching ARIA combobox", async () => {
    fakePage.elements = [{ role: "combobox", name: "Country" }];
    const page = await readPage();
    const select = page.inputs.find(i => i.text === "Country");
    expect(select).toBeTruthy();
    expect(select.options).toEqual(["India", "Japan", "Brazil"]);
    expect(select.value).toBe("India");
    expect(getElement(select.id)).toBe(fakeSelectLocator);
  });

  it("adds selects the ARIA snapshot missed as their own elements", async () => {
    const page = await readPage();
    const select = page.inputs.find(i => i.text === "Country");
    expect(select).toBeTruthy();
    expect(select.options).toEqual(["India", "Japan", "Brazil"]);
  });
});

describe("selectOption action", () => {
  it("selects a native option by label", async () => {
    fakePage.elements = [{ role: "combobox", name: "Country" }];
    const page = await readPage();
    const id = page.inputs.find(i => i.text === "Country").id;

    fakeSelectLocator.selectOption.mockResolvedValue(["japan"]);
    const result = await selectOption(id, "Japan");
    expect(result.success).toBe(true);
    expect(fakeSelectLocator.selectOption).toHaveBeenCalledWith({ label: "Japan" }, { timeout: 3000 });
  });

  it("falls back to clicking through a custom dropdown", async () => {
    fakePage.elements = [{ role: "combobox", name: "Country" }];
    const page = await readPage();
    const id = page.inputs.find(i => i.text === "Country").id;

    fakeSelectLocator.selectOption.mockRejectedValue(new Error("not a select"));
    const result = await selectOption(id, "Japan");
    expect(result.success).toBe(true);
    expect(result.custom).toBe(true);
    expect(fakeSelectLocator.click).toHaveBeenCalled();
    expect(fakeOptionLocator.click).toHaveBeenCalled();
  });

  it("refuses unknown element ids with a useful reason", async () => {
    const result = await selectOption(99999, "Japan");
    expect(result.success).toBe(false);
    expect(result.reason).toContain("read the page again");
  });
});
