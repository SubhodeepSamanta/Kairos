import { sttGainConfig } from "./config.js";

const FULL_SCALE = 32768;

export function measure(pcm) {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const s = pcm[i];
    sum += s;
    const abs = s < 0 ? -s : s;
    if (abs > peak) peak = abs;
  }
  const mean = pcm.length ? sum / pcm.length : 0;
  return { mean, peak };
}

export function conditionForStt(pcm, config = sttGainConfig) {
  if (!config.enabled || !pcm?.length) return pcm;

  const { mean, peak } = measure(pcm);
  const offset = Math.round(mean);
  const peakAfter = Math.max(1, peak - Math.abs(offset));

  if (peakAfter < config.noiseFloor) return pcm;

  const target = config.targetPeak * FULL_SCALE;
  const gain = Math.min(config.maxGain, Math.max(1, target / peakAfter));

  if (offset === 0 && gain === 1) return pcm;

  const out = new Int16Array(pcm.length);
  const limit = FULL_SCALE - 1;
  for (let i = 0; i < pcm.length; i++) {
    const scaled = Math.round((pcm[i] - offset) * gain);
    out[i] = scaled > limit ? limit : scaled < -FULL_SCALE ? -FULL_SCALE : scaled;
  }
  return out;
}
