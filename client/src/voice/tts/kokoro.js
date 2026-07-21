import { voiceConfig } from "../config.js";
import { encodeWav } from "./wav.js";

const MIN_SPEED = 0.5;
const MAX_SPEED = 2;

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
      const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, segment.rate ?? 1));
      const chosen = this.supportsVoice(voice) ? voice : undefined;

      const audio = await model.generate(segment.text, { voice: chosen, speed });
      const samples = audio.audio ?? audio.data;
      const rate = audio.sampling_rate ?? audio.sampleRate ?? 24000;
      if (!samples?.length) throw new Error("kokoro produced no audio");

      return encodeWav(samples, rate, { volume: segment.volume ?? 1 });
    }
  };
}

export function resetKokoroForTests() {
  modelPromise = null;
}
