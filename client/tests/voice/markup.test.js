import { describe, it, expect } from "vitest";
import { stripMarkup, parseDelivery, speakableSegments, hasMarkup } from "../../src/voice/markup.js";

describe("stripMarkup", () => {
  it("removes tags so text connectors never see them", () => {
    expect(stripMarkup("Yeah— [pause:300] I opened it. [smile] Done."))
      .toBe("Yeah— I opened it. Done.");
  });

  it("keeps natural punctuation that carries the pause", () => {
    expect(stripMarkup("well… that's rough — really.")).toBe("well… that's rough — really.");
  });

  it("survives junk input", () => {
    expect(stripMarkup(null)).toBe("");
    expect(stripMarkup("[bogus] plain")).toBe("[bogus] plain");
  });
});

describe("hasMarkup", () => {
  it("is repeatable across calls", () => {
    const text = "[smile] hi";
    expect(hasMarkup(text)).toBe(true);
    expect(hasMarkup(text)).toBe(true);
    expect(hasMarkup("no tags here")).toBe(false);
  });
});

describe("parseDelivery", () => {
  it("splits speech and pauses in order", () => {
    const segments = parseDelivery("one [pause:400] two");
    expect(segments.map(s => s.type)).toEqual(["speech", "pause", "speech"]);
    expect(segments[1].ms).toBe(400);
    expect(segments[2].text).toBe("two");
  });

  it("applies a style to everything after the tag", () => {
    const segments = parseDelivery("normal [soft] hushed");
    expect(segments[0].rate).toBe(1);
    expect(segments[1].rate).toBeLessThan(1);
    expect(segments[1].volume).toBeLessThan(1);
  });

  it("multiplies persona baseline with the tag style", () => {
    const segments = parseDelivery("[fast] go", { rate: 0.9 });
    expect(segments[0].rate).toBeCloseTo(0.9 * 1.18, 5);
  });

  it("clamps absurd pauses", () => {
    expect(parseDelivery("a [pause:99999] b")[1].ms).toBe(2000);
  });

  it("defaults a bare pause tag", () => {
    expect(parseDelivery("a [pause] b")[1].ms).toBe(300);
  });

  it("merges neighbouring speech of the same style", () => {
    const segments = parseDelivery("hello [bogus] world");
    expect(segments.filter(s => s.type === "speech")).toHaveLength(1);
  });

  it("drops a trailing pause so playback does not hang on silence", () => {
    const segments = parseDelivery("bye [pause:500]");
    expect(segments[segments.length - 1].type).toBe("speech");
  });
});

describe("speakableSegments", () => {
  it("never returns empty for real text", () => {
    expect(speakableSegments("just talking").map(s => s.text)).toEqual(["just talking"]);
  });

  it("returns nothing for a tag-only string", () => {
    expect(speakableSegments("[pause:200]")).toEqual([]);
  });

  it("falls back to plain speech rather than breaking on a bad tag", () => {
    const segments = speakableSegments("[pause:abc] still speaks");
    expect(segments.some(s => s.type === "speech" && s.text.includes("still speaks"))).toBe(true);
  });
});
