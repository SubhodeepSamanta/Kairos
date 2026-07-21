import { describe, it, expect } from "vitest";
import { isStopPhrase } from "../../src/voice/stopwords.js";

describe("telling her to stop", () => {
  it("recognises the ways a person says stop", () => {
    for (const phrase of [
      "stop", "Stop!", "stop it", "cancel", "cancel that",
      "never mind", "nevermind", "forget it", "abort", "that's enough", "shut up"
    ]) {
      expect(isStopPhrase(phrase), phrase).toBe(true);
    }
  });

  it("does not treat a real request containing stop as a cancel", () => {
    for (const phrase of [
      "stop the music on spotify",
      "cancel my subscription",
      "find the nearest bus stop",
      "never mind that, open my inbox",
      "how do I stop a running container"
    ]) {
      expect(isStopPhrase(phrase), phrase).toBe(false);
    }
  });

  it("ignores empty or odd input", () => {
    expect(isStopPhrase("")).toBe(false);
    expect(isStopPhrase(null)).toBe(false);
    expect(isStopPhrase("   ")).toBe(false);
  });
});
