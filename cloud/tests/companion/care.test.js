import { describe, it, expect } from "vitest";
import { detectCrisis, shouldStayQuiet, CRISIS_REPLY } from "../../src/companion/care.js";

describe("detectCrisis", () => {
  it("catches direct statements", () => {
    for (const text of [
      "i want to kill myself",
      "i think about ending my life",
      "im suicidal",
      "there's no reason to live",
      "everyone would be better off without me",
      "i've been cutting myself again"
    ]) {
      expect(detectCrisis(text), text).toBe(true);
    }
  });

  it("does not fire on ordinary frustration", () => {
    for (const text of [
      "this bug is killing me",
      "i'm dying to see the new season",
      "i'm so tired of leetcode",
      "this contest destroyed me",
      "im dead tired",
      "kill the process on port 3000"
    ]) {
      expect(detectCrisis(text), text).toBe(false);
    }
  });

  it("does not fire on clear fiction or homework context", () => {
    expect(detectCrisis("the character in the movie ends his life")).toBe(false);
    expect(detectCrisis("write an essay about suicide prevention")).toBe(false);
  });

  it("still fires when a study word appears alongside real intent", () => {
    for (const text of [
      "i can't do this essay anymore, i want to die",
      "failed the assignment again, i want to kill myself",
      "so much homework i don't want to be here"
    ]) {
      expect(detectCrisis(text), text).toBe(true);
    }
  });

  it("needs a first-person subject before a topical word counts", () => {
    expect(detectCrisis("im suicidal")).toBe(true);
    expect(detectCrisis("the overdose statistics for the report")).toBe(false);
  });

  it("ignores empty input", () => {
    expect(detectCrisis("")).toBe(false);
    expect(detectCrisis(null)).toBe(false);
  });
});

describe("CRISIS_REPLY", () => {
  it("names real help and does not pretend to be a therapist", () => {
    expect(CRISIS_REPLY).toContain("14416");
    expect(CRISIS_REPLY).toContain("AASRA");
    expect(CRISIS_REPLY.toLowerCase()).toContain("i'm an ai");
    expect(CRISIS_REPLY.toLowerCase()).not.toContain("just think positive");
  });
});

describe("shouldStayQuiet", () => {
  it("is true when venting with no request", () => {
    expect(shouldStayQuiet("i'm so exhausted")).toBe(true);
    expect(shouldStayQuiet("feeling really low today")).toBe(true);
  });

  it("is false when they ask for something even while venting", () => {
    expect(shouldStayQuiet("i'm exhausted, play some lofi")).toBe(false);
    expect(shouldStayQuiet("feeling low, open youtube")).toBe(false);
  });

  it("is false for plain tasks", () => {
    expect(shouldStayQuiet("open github")).toBe(false);
  });
});
