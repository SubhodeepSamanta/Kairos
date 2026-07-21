import { describe, it, expect } from "vitest";
import { isStopPhrase, isRepeatPhrase } from "../../src/voice/stopwords.js";

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

describe("asking her to say it again", () => {
  it("recognises the ways a person asks for a repeat", () => {
    for (const phrase of [
      "again", "repeat", "repeat that", "say that again",
      "what did you say", "what was that", "come again", "sorry what"
    ]) {
      expect(isRepeatPhrase(phrase), phrase).toBe(true);
    }
  });

  it("does not treat a real request as a repeat", () => {
    for (const phrase of [
      "repeat that email to my boss",
      "play that song again please",
      "what did you say to her yesterday",
      "search again for cheap flights"
    ]) {
      expect(isRepeatPhrase(phrase), phrase).toBe(false);
    }
  });

  it("is not confused with a stop phrase", () => {
    expect(isRepeatPhrase("stop")).toBe(false);
    expect(isStopPhrase("repeat that")).toBe(false);
  });
});
