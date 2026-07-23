import { describe, it, expect } from "vitest";
import { detectWake, editDistance, normaliseWords, phoneticKey, createWakeGate } from "../../src/voice/wake.js";
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

  it("catches mishearings by sound, not by a hardcoded list", () => {
    const heard = [
      "Chiros, play some music",
      "Kairo, what can you do",
      "Karos, hello",
      "Gyros, what time is it",
      "Kyros, what's on my calendar?",
      "Khairos open my inbox",
      "Kyrios what's the time"
    ];
    for (const line of heard) {
      expect(detectWake(line).matched, line).toBe(true);
    }
  });

  it("folds spellings that sound alike onto one key", () => {
    for (const variant of ["kyros", "cairos", "khairos", "kyrios", "chiros", "gyros", "karos"]) {
      expect(phoneticKey(variant), variant).toBe(phoneticKey("kairos"));
    }
  });

  it("keeps words that merely look close apart", () => {
    for (const other of ["close", "press", "virus", "guidals", "chorus"]) {
      expect(phoneticKey(other), other).not.toBe("");
    }
    expect(phoneticKey("close")).not.toBe(phoneticKey("kairos"));
    expect(phoneticKey("press")).not.toBe(phoneticKey("kairos"));
  });

  it("still ignores ordinary speech", () => {
    const stray = [
      "can you pass me the salt",
      "the chorus was stuck in my head",
      "I was watching a show about Cairo yesterday",
      "my car is in the shop",
      "let's go",
      "close the tab",
      "press play on spotify"
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
  it("drops what is structurally not speech, without a phrase list", () => {
    for (const junk of ["you", "You.", "Shh.", "[BLANK_AUDIO]", "(music)", "[music] (applause)", "  ", "um", "uh huh", "mhm", "so", "the"]) {
      expect(isNoiseTranscript(junk), junk).toBe(true);
    }
  });

  it("trusts the model on anything with actual words in it", () => {
    for (const real of ["thank you", "play some music", "no", "yes", "good morning"]) {
      expect(isNoiseTranscript(real), real).toBe(false);
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

  it("never mistakes a greeting for silence", () => {
    for (const greeting of ["good morning", "Good morning!", "hello", "Hello?", "hi", "hey", "okay", "thank you", "bye bye"]) {
      expect(isNoiseTranscript(greeting), greeting).toBe(false);
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
      "Kai rolls, open my inbox",
      "Carlos, open my inbox",
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
