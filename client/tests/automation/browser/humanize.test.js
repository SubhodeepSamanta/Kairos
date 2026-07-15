import { describe, it, expect, vi } from "vitest";
import { rand, moveToElement, humanType, humanScroll, HUMANIZE_ENABLED } from "../../../src/automation/browser/humanize.js";

function fakePage() {
  return {
    moves: [],
    wheels: [],
    typed: [],
    mouse: {
      move: vi.fn(async function (x, y, opts) { this.parent.moves.push({ x, y, steps: opts?.steps }); }),
      wheel: vi.fn(async function (x, y) { this.parent.wheels.push(y); })
    },
    keyboard: {
      type: vi.fn(async function (text, opts) { this.parent.typed.push({ text, delay: opts?.delay }); })
    }
  };
}

function wire(page) {
  page.mouse.parent = page;
  page.keyboard.parent = page;
  return page;
}

describe("rand", () => {
  it("stays within bounds", () => {
    for (let i = 0; i < 200; i++) {
      const v = rand(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });
});

describe("moveToElement", () => {
  it("moves the mouse inside the element box in multiple steps", async () => {
    const page = wire(fakePage());
    const locator = { boundingBox: async () => ({ x: 100, y: 200, width: 50, height: 20 }) };
    await moveToElement(page, locator);

    expect(page.moves).toHaveLength(1);
    const move = page.moves[0];
    expect(move.x).toBeGreaterThanOrEqual(100);
    expect(move.x).toBeLessThanOrEqual(150);
    expect(move.y).toBeGreaterThanOrEqual(200);
    expect(move.y).toBeLessThanOrEqual(220);
    expect(move.steps).toBeGreaterThan(1);
  });

  it("does nothing when the element has no box", async () => {
    const page = wire(fakePage());
    await moveToElement(page, { boundingBox: async () => null });
    expect(page.moves).toHaveLength(0);
  });

  it("swallows locator errors", async () => {
    const page = wire(fakePage());
    await expect(
      moveToElement(page, { boundingBox: async () => { throw new Error("detached"); } })
    ).resolves.toBeUndefined();
  });
});

describe("humanType", () => {
  it("types through the locator with a per-character delay", async () => {
    const page = wire(fakePage());
    const calls = [];
    const locator = { pressSequentially: async (text, opts) => calls.push({ text, delay: opts.delay }) };
    await humanType(page, locator, "hello");
    expect(calls[0].text).toBe("hello");
    if (HUMANIZE_ENABLED) expect(calls[0].delay).toBeGreaterThan(0);
  });

  it("falls back to the keyboard when there is no locator", async () => {
    const page = wire(fakePage());
    await humanType(page, null, "hi");
    expect(page.typed[0].text).toBe("hi");
  });
});

describe("humanScroll", () => {
  it("scrolls down in several chunks totalling roughly the amount", async () => {
    const page = wire(fakePage());
    await humanScroll(page, "down", 600);
    expect(page.wheels.length).toBeGreaterThan(1);
    const total = page.wheels.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(300);
    expect(page.wheels.every(w => w > 0)).toBe(true);
  });

  it("scrolls up with negative deltas", async () => {
    const page = wire(fakePage());
    await humanScroll(page, "up", 600);
    expect(page.wheels.every(w => w < 0)).toBe(true);
  });
});
