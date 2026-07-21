import { describe, it, expect } from "vitest";
import { createVad, frameEnergy } from "../../src/voice/vad.js";
import { FRAME_SAMPLES } from "../../src/voice/config.js";

function frame(amplitude) {
  const f = new Int16Array(FRAME_SAMPLES);
  for (let i = 0; i < f.length; i++) f[i] = i % 2 === 0 ? amplitude : -amplitude;
  return f;
}

function feed(vad, amplitude, count) {
  const events = [];
  for (let i = 0; i < count; i++) {
    const event = vad.push(frame(amplitude));
    if (event) events.push(event);
  }
  return events;
}

const QUIET = 60;
const SPEECH = 4000;

describe("frameEnergy", () => {
  it("measures the RMS of a frame", () => {
    expect(frameEnergy(frame(1000))).toBeCloseTo(1000, 5);
    expect(frameEnergy(frame(0))).toBe(0);
  });
});

describe("createVad", () => {
  it("stays silent through steady background noise", () => {
    const vad = createVad();
    expect(feed(vad, QUIET, 200)).toHaveLength(0);
    expect(vad.isSpeaking()).toBe(false);
  });

  it("fires speech_start only after the debounce window", () => {
    const vad = createVad({ startMs: 120 });
    feed(vad, QUIET, 50);
    expect(feed(vad, SPEECH, 5)).toHaveLength(0);
    const events = feed(vad, SPEECH, 3);
    expect(events.map(e => e.type)).toContain("speech_start");
  });

  it("ends the utterance after trailing silence, not on a mid-sentence pause", () => {
    const vad = createVad({ hangoverMs: 700 });
    feed(vad, QUIET, 50);
    feed(vad, SPEECH, 20);

    expect(feed(vad, QUIET, 20)).toHaveLength(0);
    feed(vad, SPEECH, 20);

    const events = feed(vad, QUIET, 40);
    const end = events.find(e => e.type === "speech_end");
    expect(end).toBeTruthy();
    expect(end.reason).toBe("silence");
    expect(end.audio.length).toBeGreaterThan(0);
  });

  it("discards a short click instead of transcribing it", () => {
    const vad = createVad({ minSpeechMs: 280 });
    feed(vad, QUIET, 50);
    feed(vad, SPEECH, 8);
    const events = feed(vad, QUIET, 40);
    expect(events.find(e => e.type === "discarded")).toBeTruthy();
    expect(events.find(e => e.type === "speech_end")).toBeFalsy();
  });

  it("includes pre-roll so the first word is not clipped", () => {
    const vad = createVad({ preRollMs: 300 });
    feed(vad, QUIET, 50);
    feed(vad, SPEECH, 30);
    const events = feed(vad, QUIET, 40);
    const end = events.find(e => e.type === "speech_end");
    expect(end.durationMs).toBeGreaterThan(end.speechMs);
  });

  it("raises its noise floor so a loud room does not read as speech", () => {
    const vad = createVad();
    const loudRoom = 400;
    feed(vad, loudRoom, 400);
    expect(vad.noiseFloor()).toBeGreaterThan(300);
    expect(vad.isSpeaking()).toBe(false);
  });

  it("caps a runaway utterance", () => {
    const vad = createVad({ maxUtteranceMs: 1000 });
    feed(vad, QUIET, 50);
    const events = feed(vad, SPEECH, 200);
    const end = events.find(e => e.type === "speech_end");
    expect(end.reason).toBe("max_length");
  });

  it("needs louder, longer speech to barge in during playback", () => {
    const vad = createVad();
    feed(vad, QUIET, 50);
    vad.setBargeIn(true);
    const quietTalk = Math.round(vad.threshold() / 2);
    expect(feed(vad, quietTalk, 40)).toHaveLength(0);
    expect(feed(vad, SPEECH, 30).map(e => e.type)).toContain("speech_start");
  });

  it("flush closes an utterance that never got its trailing silence", () => {
    const vad = createVad();
    feed(vad, QUIET, 50);
    feed(vad, SPEECH, 30);
    const end = vad.flush();
    expect(end.type).toBe("speech_end");
    expect(end.reason).toBe("flushed");
    expect(vad.flush()).toBeNull();
  });
});
