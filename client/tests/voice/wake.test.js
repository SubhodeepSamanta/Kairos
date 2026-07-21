import { describe, it, expect } from "vitest";
import { detectWake, editDistance, normaliseWords, createWakeGate } from "../../src/voice/wake.js";
import { isNoiseTranscript, pcmToFloat } from "../../src/voice/stt.js";

const WAKE = ["kairos", "kyros", "cairos", "khairos", "kyrios"];

describe("wake word", () => {
  it("matches the spellings the speech model actually produces", () => {
    const heard = [
      "Kairos, what's on my calendar?",
      "Kai Rose, what's on my calendar?",
      "Cairos find me a flight",
      "Cairo's find me a flight",
      "Chiros find me a flight",
      "Kyros, what's on my calendar?"
    ];
    for (const line of heard) {
      expect(detectWake(line, WAKE).matched, line).toBe(true);
    }
  });

  it("catches the mishearings reported from real use", () => {
    const heard = [
      "Carlos, what's the weather?",
      "Virus, open my inbox",
      "Chiros, play some music",
      "Kairo, what can you do",
      "Karos, hello",
      "Gyros, what time is it"
    ];
    for (const line of heard) {
      expect(detectWake(line).matched, line).toBe(true);
    }
  });

  it("still ignores ordinary speech after widening the variants", () => {
    const stray = [
      "can you pass me the salt",
      "the chorus was stuck in my head",
      "I was watching a show about Cairo yesterday",
      "my car is in the shop",
      "let's go",
      "close the tab"
    ];
    for (const line of stray) {
      expect(detectWake(line).matched, line).toBe(false);
    }
  });

  it("returns the command with the wake word removed", () => {
    expect(detectWake("Kairos, find me a cheap flight", WAKE).command).toBe("find me a cheap flight");
    expect(detectWake("Kai Rose what's on my calendar", WAKE).command).toBe("whats on my calendar");
  });

  it("allows a filler word in front of the wake word", () => {
    expect(detectWake("hey Kairos, open my inbox", WAKE)).toMatchObject({
      matched: true,
      command: "open my inbox"
    });
    expect(detectWake("okay Kairos stop", WAKE).command).toBe("stop");
  });

  it("reports an empty command when only the wake word was said", () => {
    expect(detectWake("Kairos", WAKE)).toEqual({ matched: true, command: "" });
    expect(detectWake("hey Kairos!", WAKE)).toEqual({ matched: true, command: "" });
  });

  it("ignores speech that was never addressed to her", () => {
    const stray = [
      "can you pass me the salt",
      "I was watching a show about Cairo yesterday",
      "the chorus was stuck in my head",
      "let's go"
    ];
    for (const line of stray) {
      expect(detectWake(line, WAKE).matched, line).toBe(false);
    }
  });

  it("does not match a wake word buried deep in a sentence", () => {
    expect(detectWake("I told her that Kairos should handle it", WAKE).matched).toBe(false);
  });

  it("measures edit distance", () => {
    expect(editDistance("kairos", "kairos")).toBe(0);
    expect(editDistance("cairos", "kairos")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("folds possessives and punctuation away", () => {
    expect(normaliseWords("Cairo's, find me!")).toEqual(["cairos", "find", "me"]);
  });
});

describe("wake gate", () => {
  it("opens a follow-up window when only the wake word was said", () => {
    let clock = 0;
    const gate = createWakeGate({ requireWake: true, followUpMs: 8000, now: () => clock });

    expect(gate.consider("Kairos")).toMatchObject({ action: "listen" });
    expect(gate.isOpen()).toBe(true);

    clock = 3000;
    expect(gate.consider("what's the weather")).toMatchObject({
      action: "send",
      command: "what's the weather",
      viaWake: false
    });
  });

  it("closes the window once it expires", () => {
    let clock = 0;
    const gate = createWakeGate({ requireWake: true, followUpMs: 8000, now: () => clock });
    gate.consider("Kairos");

    clock = 9000;
    expect(gate.consider("what's the weather")).toEqual({ action: "ignore" });
  });

  it("keeps the conversation open while she is being talked to", () => {
    let clock = 0;
    const gate = createWakeGate({ requireWake: true, followUpMs: 8000, now: () => clock });
    gate.consider("Kairos, hello");

    clock = 7000;
    expect(gate.consider("and what about tomorrow")).toMatchObject({ action: "send" });
    clock = 13000;
    expect(gate.consider("still there")).toMatchObject({ action: "send" });
  });

  it("sends a wake word plus command straight through", () => {
    const gate = createWakeGate({ requireWake: true, followUpMs: 8000, now: () => 0 });
    expect(gate.consider("Kairos, open my inbox")).toMatchObject({
      action: "send",
      command: "open my inbox",
      viaWake: true
    });
  });

  it("skips the wake word entirely when it is not required", () => {
    const gate = createWakeGate({ requireWake: false, followUpMs: 8000, now: () => 0 });
    expect(gate.consider("open my inbox")).toMatchObject({ action: "send", viaWake: false });
  });

  it("ignores an empty transcript", () => {
    const gate = createWakeGate({ requireWake: true, followUpMs: 8000, now: () => 0 });
    expect(gate.consider("   ")).toEqual({ action: "ignore" });
  });
});

describe("transcript filtering", () => {
  it("drops the phantom words speech models emit on silence", () => {
    for (const junk of ["you", "You.", "Thanks for watching!", "Shh.", "[BLANK_AUDIO]", "  ", "um"]) {
      expect(isNoiseTranscript(junk), junk).toBe(true);
    }
  });

  it("drops stuck repeated tokens", () => {
    expect(isNoiseTranscript("oh oh oh oh oh")).toBe(true);
  });

  it("keeps real speech", () => {
    for (const real of ["open my inbox", "what's on my calendar tomorrow", "yeah that works"]) {
      expect(isNoiseTranscript(real), real).toBe(false);
    }
  });

  it("normalises pcm into the range the model expects", () => {
    const out = pcmToFloat(new Int16Array([0, 16384, -32768]));
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(0.5, 3);
    expect(out[2]).toBe(-1);
  });
});

describe("mishearings seen in the wild", () => {
  it("catches the ways the speech model mangles her name", () => {
    const heard = [
      "Titos, open my inbox",
      "Kai rolls, open my inbox",
      "Thai rolls, open my inbox",
      "Cairo's open my inbox",
      "Kai rose, open my inbox"
    ];
    for (const line of heard) {
      expect(detectWake(line).matched, line).toBe(true);
    }
  });

  it("still does not wake on unrelated speech", () => {
    for (const line of ["the potatoes are done", "roll the dice", "close the door", "my car broke down"]) {
      expect(detectWake(line).matched, line).toBe(false);
    }
  });
});
