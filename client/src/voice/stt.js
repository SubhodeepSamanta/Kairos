import { voiceConfig, SAMPLE_RATE } from "./config.js";
import { sttWanted, sttSettled } from "./runtimeOrder.js";
import { conditionForStt, trimSilence } from "./audio.js";

const MIN_SAMPLES = SAMPLE_RATE * 0.2;
const MAX_SAMPLES = SAMPLE_RATE * 30;

const NON_LEXICAL = /^(?:m+h*m*|h+m+|u+h+|u+m+|a+h+|o+h+|e+h+|sh+|ts+k*|ug+h*|ps+t*|hu+h*|pf+t*)$/;
const FUNCTION_WORDS = new Set(["you", "the", "a", "an", "and", "so", "but", "or", "to", "of", "it", "is", "i"]);

let asrPromise = null;

export function pcmToFloat(pcm) {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768;
  return out;
}

export function isNoiseTranscript(text) {
  const spoken = String(text || "").replace(/[\[\(][^\]\)]*[\]\)]/g, " ");
  const bare = spoken
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bare) return true;
  const words = bare.split(" ");
  if (words.every(w => NON_LEXICAL.test(w))) return true;
  if (words.length === 1 && FUNCTION_WORDS.has(words[0])) return true;
  const unique = new Set(words);
  return words.length >= 4 && unique.size === 1;
}

async function loadModel(onProgress) {
  const { pipeline } = await import("@huggingface/transformers");
  let announced = false;
  return pipeline("automatic-speech-recognition", voiceConfig.sttModel, {
    dtype: voiceConfig.sttQuantization,
    device: "cpu",
    progress_callback: (info) => {
      if (info?.status === "download" && !announced) {
        announced = true;
        onProgress?.("loading her ears (first run downloads ~190MB)…");
      }
    }
  });
}

export function createTranscriber() {
  sttWanted();
  return {
    async ready(onProgress) {
      if (!asrPromise) {
        asrPromise = loadModel(onProgress).then(
          (model) => { sttSettled(); return model; },
          (err) => { asrPromise = null; sttSettled(); throw err; }
        );
      }
      await asrPromise;
      return true;
    },

    async transcribe(pcm) {
      if (!pcm?.length || pcm.length < MIN_SAMPLES) return null;
      const asr = await asrPromise;
      if (!asr) throw new Error("the listening model is not loaded yet");

      const clipped = pcm.length > MAX_SAMPLES ? pcm.subarray(0, MAX_SAMPLES) : pcm;
      const samples = conditionForStt(trimSilence(clipped));
      const result = await asr(pcmToFloat(samples));
      const text = String(result?.text || "").trim();

      if (!text || isNoiseTranscript(text)) return null;
      return { text, durationMs: Math.round((samples.length / SAMPLE_RATE) * 1000) };
    }
  };
}

export function resetTranscriberForTests() {
  asrPromise = null;
}
