import { describe, it, expect } from "vitest";
import { createHistory } from "../../src/connectors/cli/history.js";

describe("console history", () => {
  it("walks back through what was typed, newest first", () => {
    const h = createHistory({ load: false });
    h.add("first");
    h.add("second");
    h.add("third");

    expect(h.up("")).toBe("third");
    expect(h.up("")).toBe("second");
    expect(h.up("")).toBe("first");
    expect(h.up("")).toBeNull();
  });

  it("walks forward again and restores the draft being typed", () => {
    const h = createHistory({ load: false });
    h.add("older");
    h.add("newer");

    expect(h.up("half typed")).toBe("newer");
    expect(h.up("half typed")).toBe("older");
    expect(h.down()).toBe("newer");
    expect(h.down()).toBe("half typed");
    expect(h.down()).toBeNull();
  });

  it("does not repeat the same entry twice in a row", () => {
    const h = createHistory({ load: false });
    h.add("play lofi");
    h.add("play lofi");
    expect(h.size()).toBe(1);
  });

  it("caps how much it keeps", () => {
    const h = createHistory({ load: false });
    for (let i = 0; i < 80; i++) h.add(`goal ${i}`);
    expect(h.size()).toBe(50);
    expect(h.up("")).toBe("goal 79");
  });

  it("submitting resets the walk so up starts from the newest again", () => {
    const h = createHistory({ load: false });
    h.add("one");
    h.add("two");
    h.up("");
    h.up("");
    h.add("three");
    expect(h.up("")).toBe("three");
  });

  it("ignores blank entries", () => {
    const h = createHistory({ load: false });
    h.add("   ");
    expect(h.size()).toBe(0);
    expect(h.up("")).toBeNull();
  });
});
