import { describe, it, expect, beforeEach } from "vitest";
import { normalizeControl, normalizeElements, assignIds } from "../../src/automation/desktop/windows/uia.js";
import { formatDesktopSnapshot } from "../../src/automation/desktop/snapshot.js";
import {
  resetDesktop,
  registerDesktopElement,
  getDesktopElement,
  hasDesktopElement,
  desktopElementCount
} from "../../src/automation/desktop/registry.js";

const RAW = [
  { ref: 0, name: "Untitled - Notepad", control: "ControlType.Window", patterns: [], rect: { x: 0, y: 0, w: 800, h: 600 }, enabled: true, offscreen: false },
  { ref: 1, name: "File", control: "ControlType.MenuItem", patterns: ["invoke", "expandcollapse"], rect: { x: 4, y: 30, w: 40, h: 20 }, enabled: true, offscreen: false },
  { ref: 2, name: "", control: "ControlType.Edit", patterns: ["value"], rect: { x: 0, y: 60, w: 800, h: 540 }, enabled: true, offscreen: false },
  { ref: 3, name: "Hidden thing", control: "ControlType.Button", patterns: ["invoke"], rect: { x: -1, y: -1, w: 0, h: 0 }, enabled: true, offscreen: true },
  { ref: 4, name: "", control: "ControlType.Pane", patterns: [], rect: { x: 0, y: 0, w: 10, h: 10 }, enabled: true, offscreen: false },
  { ref: 5, name: "File", control: "ControlType.MenuItem", patterns: ["invoke", "expandcollapse"], rect: { x: 4, y: 30, w: 40, h: 20 }, enabled: true, offscreen: false }
];

describe("normalizeControl", () => {
  it("strips the ControlType prefix", () => {
    expect(normalizeControl("ControlType.Button")).toBe("Button");
    expect(normalizeControl("")).toBe("Unknown");
  });
});

describe("normalizeElements", () => {
  it("drops offscreen elements, nameless non-input noise, and duplicates", () => {
    const els = normalizeElements(RAW);
    const controls = els.map(e => `${e.control}:${e.name}`);
    expect(controls).toContain("Window:Untitled - Notepad");
    expect(controls).toContain("MenuItem:File");
    expect(controls).toContain("Edit:");
    expect(controls).not.toContain("Button:Hidden thing");
    expect(controls).not.toContain("Pane:");
    expect(controls.filter(c => c === "MenuItem:File")).toHaveLength(1);
  });

  it("keeps the ref for actuation and a valid rect only", () => {
    const edit = normalizeElements(RAW).find(e => e.control === "Edit");
    expect(edit.ref).toBe(2);
    expect(edit.rect).toEqual({ x: 0, y: 60, w: 800, h: 540 });
  });

  it("respects the element cap", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ ref: i, name: `Item ${i}`, control: "ControlType.Button", patterns: ["invoke"], rect: { x: 0, y: i, w: 5, h: 5 } }));
    expect(normalizeElements(many, 50)).toHaveLength(50);
  });
});

describe("assignIds", () => {
  it("numbers elements from 1 while preserving their ref", () => {
    const withIds = assignIds(normalizeElements(RAW));
    expect(withIds[0].id).toBe(1);
    expect(withIds[withIds.length - 1].id).toBe(withIds.length);
    expect(withIds.find(e => e.control === "Edit").ref).toBe(2);
  });
});

describe("formatDesktopSnapshot", () => {
  it("renders window, ids, control types and action hints", () => {
    const elements = assignIds(normalizeElements(RAW));
    const text = formatDesktopSnapshot({ window: { title: "Untitled - Notepad", app: "notepad" }, elements });
    expect(text).toContain("DESKTOP WINDOW: Untitled - Notepad (notepad)");
    expect(text).toMatch(/\[\d+\] MenuItem "File" \(click\/menu\)/);
    expect(text).toMatch(/\[\d+\] Edit \(type\)/);
  });

  it("says so when the window exposes no elements", () => {
    expect(formatDesktopSnapshot({ window: { title: "Game", app: "game" }, elements: [] })).toMatch(/no accessibility tree|none readable/);
  });

  it("guides back to open_app when nothing is focused", () => {
    expect(formatDesktopSnapshot({})).toMatch(/open_app or focus_app/);
  });
});

describe("desktop registry", () => {
  beforeEach(() => resetDesktop({ title: "w" }));

  it("stores and retrieves elements by id and clears on reset", () => {
    registerDesktopElement(1, { ref: 7, name: "Save" });
    expect(hasDesktopElement(1)).toBe(true);
    expect(getDesktopElement(1).ref).toBe(7);
    expect(desktopElementCount()).toBe(1);
    resetDesktop();
    expect(hasDesktopElement(1)).toBe(false);
    expect(desktopElementCount()).toBe(0);
  });
});
