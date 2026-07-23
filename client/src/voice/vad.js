import { vadConfig, msToFrames } from "./config.js";

export function frameEnergy(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / (frame.length || 1));
}

function concatFrames(frames) {
  let total = 0;
  for (const f of frames) total += f.length;
  const out = new Int16Array(total);
  let at = 0;
  for (const f of frames) {
    out.set(f, at);
    at += f.length;
  }
  return out;
}

export function createVad(overrides = {}) {
  const cfg = { ...vadConfig, ...overrides };
  const startFrames = msToFrames(cfg.startMs);
  const hangoverFrames = msToFrames(cfg.hangoverMs);
  const preRollFrames = msToFrames(cfg.preRollMs);
  const minSpeechFrames = msToFrames(cfg.minSpeechMs);
  const maxFrames = msToFrames(cfg.maxUtteranceMs);
  const minFloor = Math.max(1, cfg.absoluteFloor / 4);

  let noiseFloor = cfg.absoluteFloor;
  let seeded = false;
  let speaking = false;
  let loudRun = 0;
  let quietRun = 0;
  let speechFrames = 0;
  let collected = [];
  let preRoll = [];
  let lastLevel = 0;
  let floor = cfg.absoluteFloor;

  const threshold = () => Math.max(noiseFloor * cfg.noiseRatio, floor);

  function endUtterance(reason) {
    const frames = collected;
    const spoken = speechFrames;
    collected = [];
    preRoll = [];
    speaking = false;
    loudRun = 0;
    quietRun = 0;
    speechFrames = 0;
    if (spoken < minSpeechFrames) {
      return { type: "discarded", reason: "too_short", speechMs: spoken * cfg.frameMs };
    }
    return {
      type: "speech_end",
      reason,
      audio: concatFrames(frames),
      durationMs: frames.length * cfg.frameMs,
      speechMs: spoken * cfg.frameMs
    };
  }

  return {
    push(frame) {
      const level = frameEnergy(frame);
      lastLevel = level;
      if (!seeded) {
        seeded = true;
        noiseFloor = Math.max(minFloor, level);
      }
      const loud = level > threshold();

      if (!speaking) {
        preRoll.push(frame);
        if (preRoll.length > preRollFrames) preRoll.shift();

        if (!loud) {
          loudRun = 0;
          noiseFloor = Math.max(minFloor, noiseFloor * (1 - cfg.noiseAdapt) + level * cfg.noiseAdapt);
          return null;
        }

        loudRun++;
        if (loudRun < startFrames) return null;

        speaking = true;
        collected = preRoll.slice();
        preRoll = [];
        speechFrames = loudRun;
        quietRun = 0;
        return { type: "speech_start", level };
      }

      collected.push(frame);
      if (loud) {
        quietRun = 0;
        speechFrames++;
      } else {
        quietRun++;
      }

      if (quietRun >= hangoverFrames) return endUtterance("silence");
      if (collected.length >= maxFrames) return endUtterance("max_length");
      return null;
    },

    flush() {
      if (!speaking) return null;
      return endUtterance("flushed");
    },

    reset() {
      speaking = false;
      loudRun = 0;
      quietRun = 0;
      speechFrames = 0;
      collected = [];
      preRoll = [];
    },

    calibrate(ambientPeak) {
      if (!(ambientPeak > 0)) return floor;
      const wanted = Math.round(ambientPeak * cfg.calibrationHeadroom);
      floor = Math.min(cfg.maxFloor, Math.max(cfg.absoluteFloor, wanted));
      noiseFloor = Math.max(minFloor, Math.min(ambientPeak, floor));
      seeded = true;
      return floor;
    },

    floor: () => floor,

    isSpeaking: () => speaking,
    noiseFloor: () => noiseFloor,
    threshold,
    level: () => lastLevel
  };
}
