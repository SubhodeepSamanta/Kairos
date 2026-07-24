import { describe, it, expect } from "vitest";
import { conditionForStt, measure, trimSilence } from "../../src/voice/audio.js";

const config = { enabled: true, targetPeak: 0.7, maxGain: 8, noiseFloor: 200 };

function tone(peak, length = 1600, offset = 0) {
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) out[i] = offset + Math.round(Math.sin(i / 4) * peak);
  return out;
}

describe("conditionForStt", () => {
  it("lifts a quiet utterance toward the target peak", () => {
    const quiet = tone(2000);
    const out = conditionForStt(quiet, config);
    const after = measure(out).peak;
    expect(after).toBeGreaterThan(measure(quiet).peak * 2);
    expect(after).toBeLessThanOrEqual(0.7 * 32768 + 1);
  });

  it("never amplifies past the gain cap", () => {
    const whisper = tone(300);
    const out = conditionForStt(whisper, config);
    const ratio = measure(out).peak / measure(whisper).peak;
    expect(ratio).toBeLessThanOrEqual(8 + 0.1);
    expect(measure(out).peak).toBeLessThan(0.1 * 32768);
  });

  it("leaves near-silence untouched rather than amplifying noise", () => {
    const noise = tone(80);
    expect(conditionForStt(noise, config)).toBe(noise);
  });

  it("removes a DC offset that would bias energy", () => {
    const biased = tone(3000, 1600, 5000);
    const centred = measure(conditionForStt(biased, config)).mean;
    expect(Math.abs(centred)).toBeLessThan(200);
  });

  it("does not clip a signal that is already near full scale", () => {
    const loud = tone(30000);
    const out = conditionForStt(loud, config);
    expect(measure(out).peak).toBeLessThanOrEqual(32767);
  });

  it("is a no-op when disabled", () => {
    const pcm = tone(2000);
    expect(conditionForStt(pcm, { ...config, enabled: false })).toBe(pcm);
  });

  it("survives empty input", () => {
    expect(conditionForStt(new Int16Array(0), config).length).toBe(0);
  });
});

describe("trimSilence", () => {
  function withSilence(leadMs, speechMs, trailMs) {
    const rate = 16000;
    const lead = Math.round((leadMs / 1000) * rate);
    const speech = Math.round((speechMs / 1000) * rate);
    const trail = Math.round((trailMs / 1000) * rate);
    const out = new Int16Array(lead + speech + trail);
    for (let i = 0; i < speech; i++) out[lead + i] = Math.round(Math.sin(i / 4) * 8000);
    return { pcm: out, lead, speech, trail };
  }

  it("drops long leading and trailing silence but keeps the speech", () => {
    const { pcm, speech } = withSilence(700, 500, 900);
    const out = trimSilence(pcm);
    expect(out.length).toBeLessThan(pcm.length);
    expect(out.length).toBeGreaterThanOrEqual(speech);
    expect(measure(out).peak).toBe(measure(pcm).peak);
  });

  it("keeps a margin of context rather than cutting to the exact edge", () => {
    const { pcm, speech } = withSilence(700, 500, 900);
    const margin = Math.round((90 / 1000) * 16000);
    expect(trimSilence(pcm).length).toBeGreaterThan(speech + margin);
  });

  it("is a no-op when there is no silence to trim", () => {
    const { pcm } = withSilence(0, 500, 0);
    expect(trimSilence(pcm)).toBe(pcm);
  });

  it("survives empty input", () => {
    expect(trimSilence(new Int16Array(0)).length).toBe(0);
  });
});
