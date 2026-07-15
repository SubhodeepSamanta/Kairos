import { describe, it, expect, vi, beforeEach } from "vitest";

const fakePage = {
  elements: [],
  url: () => "https://fake.test/search",
  title: async () => "Fake Search",
  evaluate: async () => 800,
  locator: () => makeLocator({}),
  getByRole: (role, opts) => makeLocator({ role, name: opts?.name })
};

function ariaYaml() {
  return fakePage.elements
    .map(e => `- ${e.role} "${e.name}"${e.enabled === false ? " [disabled]" : ""}`)
    .join("\n");
}

function makeLocator(meta) {
  const found = fakePage.elements.find(e => e.role === meta.role && e.name === meta.name);
  return {
    first: () => makeLocator(meta),
    nth: () => makeLocator(meta),
    count: async () => 0,
    ariaSnapshot: async () => ariaYaml(),
    isVisible: async () => (found ? found.visible !== false : true),
    isEnabled: async () => (found ? found.enabled !== false : true),
    boundingBox: async () => (found ? { x: 10, y: found.top ?? 100, width: 120, height: 30 } : null),
    evaluate: async () => "",
    innerText: async () => ""
  };
}

vi.mock("../../../src/automation/browser/browser.js", () => ({
  getPage: async () => fakePage,
  listTabs: async () => [{ index: 0, title: "Fake Search", url: "https://fake.test/search", active: true }]
}));
vi.mock("../../../src/automation/browser/actions/observation/pageReader.js", () => ({
  extractPageText: async () => "some page text"
}));
vi.mock("../../../src/automation/browser/actions/observation/buttonReader.js", () => ({ readButtons: async () => [] }));
vi.mock("../../../src/automation/browser/actions/observation/inputReader.js", () => ({ readInputs: async () => [] }));
vi.mock("../../../src/automation/browser/actions/observation/linkReader.js", () => ({ readLinks: async () => [] }));

const { readPage } = await import("../../../src/automation/browser/actions/observation/read.js");
const { getElement } = await import("../../../src/automation/browser/elements/registry.js");

beforeEach(() => {
  fakePage.elements = [];
});

describe("readPage with a simulated page", () => {
  it("registers every interactive element with a clickable id", async () => {
    fakePage.elements = [
      { role: "searchbox", name: "Search", top: 50 },
      { role: "button", name: "Go", top: 55 },
      { role: "link", name: "First result", top: 200 }
    ];

    const page = await readPage();

    expect(page.success).toBe(true);
    expect(page.url).toBe("https://fake.test/search");
    expect(page.inputs).toHaveLength(1);
    expect(page.buttons).toHaveLength(1);
    expect(page.links).toHaveLength(1);
    expect(getElement(page.inputs[0].id)).toBeTruthy();
    expect(getElement(page.links[0].id)).toBeTruthy();
  });

  it("never drops inputs no matter how many exist (the old slicing bug)", async () => {
    fakePage.elements = Array.from({ length: 30 }, (_, i) => ({
      role: "textbox",
      name: `Field ${i + 1}`,
      top: i * 10
    }));

    const page = await readPage();
    expect(page.inputs).toHaveLength(30);
    expect(page.inputs.map(i => i.text)).toContain("Field 30");
  });

  it("sorts elements top-down so the model sees the page like a human", async () => {
    fakePage.elements = [
      { role: "link", name: "Bottom", top: 900 },
      { role: "link", name: "Top", top: 10 },
      { role: "link", name: "Middle", top: 400 }
    ];

    const page = await readPage();
    expect(page.links.map(l => l.text)).toEqual(["Top", "Middle", "Bottom"]);
  });

  it("marks disabled elements instead of hiding them", async () => {
    fakePage.elements = [{ role: "button", name: "Submit", top: 10, enabled: false }];

    const page = await readPage();
    expect(page.buttons[0].disabled).toBe(true);
  });

  it("skips invisible elements", async () => {
    fakePage.elements = [
      { role: "button", name: "Visible", top: 10 },
      { role: "button", name: "Hidden", top: 20, visible: false }
    ];

    const page = await readPage();
    expect(page.buttons.map(b => b.text)).toEqual(["Visible"]);
  });

  it("reports failure when there is no page", async () => {
    const browser = await import("../../../src/automation/browser/browser.js");
    const original = browser.getPage;
    vi.spyOn(browser, "getPage").mockResolvedValueOnce(null);
    const page = await readPage();
    expect(page.success).toBe(false);
    browser.getPage = original;
  });
});
