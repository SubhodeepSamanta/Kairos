import { voiceConfig, SAMPLE_RATE } from "./config.js";

const MIN_SAMPLES = SAMPLE_RATE * 0.2;
const MAX_SAMPLES = SAMPLE_RATE * 30;

const NOISE_TRANSCRIPTS = new Set([
  "you", "thank you", "thanks for watching", "shh", "hmm", "uh", "um",
  "ah", "mm", "mhm", "beep", "music",
  "silence", "blank audio", "inaudible", "no speech", "background noise"
]);

let asrPromise = null;

export function pcmToFloat(pcm) {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768;
  return out;
}

export function isNoiseTranscript(text) {
  const bare = String(text || "")
    .toLowerCase()
    .replace(/[\[\](){}<>]/g, " ")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bare) return true;
  if (NOISE_TRANSCRIPTS.has(bare)) return true;
  const words = bare.split(" ");
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
  return {
    async ready(onProgress) {
      if (!asrPromise) {
        asrPromise = loadModel(onProgress).catch((err) => {
          asrPromise = null;
          throw err;
        });
      }
      await asrPromise;
      return true;
    },

    async transcribe(pcm) {
      if (!pcm?.length || pcm.length < MIN_SAMPLES) return null;
      const asr = await asrPromise;
      if (!asr) throw new Error("the listening model is not loaded yet");

      const samples = pcm.length > MAX_SAMPLES ? pcm.subarray(0, MAX_SAMPLES) : pcm;
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
