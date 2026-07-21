import { voiceConfig } from "../config.js";
import { encodeWav } from "./wav.js";

const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const MIN_PITCH = 0.8;
const MAX_PITCH = 1.25;

function resample(samples, ratio) {
  if (!(ratio > 0) || Math.abs(ratio - 1) < 0.005) return samples;
  const out = new Float32Array(Math.max(1, Math.floor(samples.length / ratio)));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = samples[idx] ?? 0;
    const b = samples[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

let modelPromise = null;

async function loadModel(onProgress) {
  const { KokoroTTS } = await import("kokoro-js");
  let announced = false;
  return KokoroTTS.from_pretrained(voiceConfig.ttsModel, {
    dtype: voiceConfig.ttsQuantization,
    device: "cpu",
    progress_callback: (info) => {
      if (info?.status === "download" && !announced) {
        announced = true;
        onProgress?.("loading her voice (first run downloads ~160MB)…");
      }
    }
  });
}

export function createKokoroEngine() {
  let voices = null;

  return {
    name: "kokoro",

    async ready(onProgress) {
      if (!modelPromise) {
        modelPromise = loadModel(onProgress).catch((err) => {
          modelPromise = null;
          throw err;
        });
      }
      const model = await modelPromise;
      voices = voices || Object.keys(model.voices || {});
      return true;
    },

    supportsVoice(voice) {
      return !voices || !voice || voices.includes(voice);
    },

    async synthesize(segment, voice) {
      const model = await modelPromise;
      const pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, segment.pitch ?? 1));
      const wanted = Math.min(MAX_SPEED, Math.max(MIN_SPEED, segment.rate ?? 1));
      const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, wanted / pitch));
      const chosen = this.supportsVoice(voice) ? voice : undefined;

      const audio = await model.generate(segment.text, { voice: chosen, speed });
      const samples = audio.audio ?? audio.data;
      const rate = audio.sampling_rate ?? audio.sampleRate ?? 24000;
      if (!samples?.length) throw new Error("kokoro produced no audio");

      return encodeWav(resample(samples, pitch), rate, { volume: segment.volume ?? 1 });
    }
  };
}

export function resetKokoroForTests() {
  modelPromise = null;
}
