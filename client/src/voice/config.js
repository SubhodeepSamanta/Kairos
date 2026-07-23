const num = (name, fallback) => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? raw : fallback;
};

const flag = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return !/^(0|false|off|no)$/i.test(String(raw).trim());
};

export const SAMPLE_RATE = 16000;
export const FRAME_MS = 20;
export const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000;
export const BYTES_PER_SAMPLE = 2;

export const voiceConfig = {
  enabled: flag("VOICE", false),
  wakeWords: String(process.env.VOICE_WAKE_WORDS || "kairos,kairo")
    .split(",")
    .map(w => w.trim().toLowerCase())
    .filter(Boolean),
  requireWake: flag("VOICE_REQUIRE_WAKE", false),
  followUpMs: num("VOICE_FOLLOW_UP_MS", 8000),
  device: process.env.VOICE_INPUT_DEVICE || null,
  speak: flag("VOICE_SPEAK", true),
  ttsEngine: process.env.VOICE_TTS_ENGINE || "auto",
  sttModel: process.env.VOICE_STT_MODEL || "onnx-community/moonshine-base-ONNX",
  sttQuantization: process.env.VOICE_STT_DTYPE || "fp32",
  ttsModel: process.env.VOICE_TTS_MODEL || "onnx-community/Kokoro-82M-v1.0-ONNX",
  ttsQuantization: process.env.VOICE_TTS_DTYPE || "fp16",
  modelCache: process.env.VOICE_MODEL_CACHE || null
};

export const sttGainConfig = {
  enabled: flag("VOICE_STT_GAIN", true),
  targetPeak: Math.min(0.99, Math.max(0.1, num("VOICE_STT_TARGET_PEAK", 0.7))),
  maxGain: Math.max(1, num("VOICE_STT_MAX_GAIN", 8)),
  noiseFloor: Math.max(1, num("VOICE_STT_GAIN_FLOOR", 50))
};

export const vadConfig = {
  frameMs: FRAME_MS,
  noiseRatio: num("VOICE_NOISE_RATIO", 3.2),
  absoluteFloor: num("VOICE_ABS_FLOOR", 50),
  calibrationHeadroom: num("VOICE_CALIBRATION_HEADROOM", 1.8),
  maxFloor: num("VOICE_MAX_FLOOR", 600),
  minVoicedRatio: num("VOICE_MIN_VOICED", 0.30),
  speechSnr: num("VOICE_SPEECH_SNR", 1.2),
  calibrationMs: num("VOICE_CALIBRATION_MS", 1200),
  startMs: num("VOICE_START_MS", 120),
  hangoverMs: num("VOICE_HANGOVER_MS", 700),
  preRollMs: num("VOICE_PREROLL_MS", 300),
  minSpeechMs: num("VOICE_MIN_SPEECH_MS", 240),
  maxUtteranceMs: num("VOICE_MAX_UTTERANCE_MS", 20000),
  bargeInRatio: num("VOICE_BARGE_RATIO", 3.5),
  bargeInMs: num("VOICE_BARGE_MS", 240),
  noiseAdapt: num("VOICE_NOISE_ADAPT", 0.05)
};

export function msToFrames(ms) {
  return Math.max(1, Math.round(ms / FRAME_MS));
}
