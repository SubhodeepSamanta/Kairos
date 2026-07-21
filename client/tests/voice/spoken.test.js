import { describe, it, expect } from "vitest";
import { toSpokenText } from "../../src/voice/spoken.js";

describe("writing text out for a voice", () => {
  it("says units instead of spelling out symbols", () => {
    expect(toSpokenText("about -60 °C today")).toContain("60 degrees celsius");
    expect(toSpokenText("72°F outside")).toContain("72 degrees fahrenheit");
    expect(toSpokenText("battery at 85%")).toContain("85 percent");
    expect(toSpokenText("costs $20")).toContain("20 dollars");
  });

  it("says the site name rather than reading a url out loud", () => {
    expect(toSpokenText("I opened https://www.youtube.com/watch?v=abc for you")).toBe("I opened youtube for you");
    expect(toSpokenText("see https://news.ycombinator.com/")).toContain("news.ycombinator");
  });

  it("keeps link text and drops the target", () => {
    expect(toSpokenText("check [the docs](https://example.com/docs)")).toBe("check the docs");
  });

  it("turns typographic characters into things a voice can read", () => {
    expect(toSpokenText("carbon‑dioxide")).toBe("carbon-dioxide");
    expect(toSpokenText("she said “hi”")).toBe('she said "hi"');
    expect(toSpokenText("wait…")).toBe("wait...");
  });

  it("flattens a bulleted list into sentences", () => {
    const spoken = toSpokenText("Here you go:\n- first thing\n- second thing");
    expect(spoken).not.toContain("-");
    expect(spoken).toContain("first thing");
    expect(spoken).toContain("second thing");
  });

  it("strips markdown emphasis that would be read as noise", () => {
    expect(toSpokenText("that is **really** important")).toBe("that is really important");
  });

  it("reads an email address naturally", () => {
    expect(toSpokenText("mail bob@example.com")).toBe("mail bob at example.com");
  });

  it("leaves ordinary speech untouched", () => {
    const plain = "Hey, I found three flights under two hundred dollars.";
    expect(toSpokenText(plain)).toBe(plain);
  });

  it("survives empty and odd input", () => {
    expect(toSpokenText("")).toBe("");
    expect(toSpokenText(null)).toBe("");
  });
});

describe("punctuation after flattening", () => {
  it("does not leave a stray period after a colon", () => {
    expect(toSpokenText("Here's the board:\n- one thing\n- another")).toBe(
      "Here's the board: one thing. another"
    );
  });

  it("keeps a trailing ellipsis, which the voice reads as a pause", () => {
    expect(toSpokenText("well…")).toBe("well...");
  });
});
