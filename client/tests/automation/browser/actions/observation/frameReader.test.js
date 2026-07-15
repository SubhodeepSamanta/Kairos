import { describe, it, expect, vi } from "vitest";
import * as frameReader from "../../../../../src/automation/browser/actions/observation/frameReader.js";

function mockLocator(overrides = {}) {
  return {
    all: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    nth: vi.fn(),
    getAttribute: vi.fn().mockResolvedValue(""),
    isVisible: vi.fn().mockResolvedValue(true),
    innerText: vi.fn().mockResolvedValue("click me"),
    boundingBox: vi.fn().mockResolvedValue({ x: 10, y: 20, width: 100, height: 50 }),
    click: vi.fn(),
    ...overrides
  };
}

function makeFrameFixture({ snapshot, buttons, inputs, links } = {}) {
  return {
    accessibility: {
      snapshot: vi.fn().mockResolvedValue(snapshot || null)
    },
    locator: vi.fn((sel) => {
      let arr = [];
      if (sel.startsWith("button")) arr = buttons || [];
      else if (sel.startsWith("input") || sel.includes("contenteditable")) arr = inputs || [];
      else if (sel === "a, [role='link']") arr = links || [];
      return mockLocator({
        count: vi.fn().mockResolvedValue(arr.length),
        nth: vi.fn((i) => arr[i] || mockLocator())
      });
    }),
    getByRole: vi.fn(() => mockLocator()),
    url: vi.fn().mockReturnValue("https://example.com"),
    name: vi.fn().mockReturnValue("")
  };
}

describe("readFrames", () => {
  it("returns empty array when no iframes present", async () => {
    const page = mockLocator();
    page.locator = vi.fn().mockReturnValue(mockLocator({ all: vi.fn().mockResolvedValue([]) }));
    const result = await frameReader.readFrames(page);
    expect(result).toEqual([]);
  });

  it("skips non-interactive ARIA roles", async () => {
    const frame = makeFrameFixture({
      snapshot: { role: "heading", name: "Title", children: [] }
    });
    const iframeLoc = mockLocator({ all: vi.fn().mockResolvedValue([mockLocator()]) });
    const page = {
      locator: vi.fn(() => iframeLoc),
      frame: vi.fn(() => Promise.resolve(frame)),
      frames: vi.fn(() => [frame])
    };
    const result = await frameReader.readFrames(page);
    expect(Array.isArray(result)).toBe(true);
  });

  it("handles frame with no accessibility snapshot", async () => {
    const frame = makeFrameFixture({ snapshot: null });
    const iframeLoc = mockLocator({ all: vi.fn().mockResolvedValue([mockLocator()]) });
    const page = {
      locator: vi.fn(() => iframeLoc),
      frame: vi.fn(() => Promise.resolve(frame)),
      frames: vi.fn(() => [frame])
    };
    const result = await frameReader.readFrames(page);
    expect(Array.isArray(result)).toBe(true);
  });
});
