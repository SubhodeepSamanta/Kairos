import { sttGainConfig, SAMPLE_RATE } from "./config.js";

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

export function trimSilence(pcm, marginMs = 90) {
  if (!pcm?.length) return pcm;
  const { peak } = measure(pcm);
  const threshold = Math.max(150, peak * 0.03);
  let start = 0;
  let end = pcm.length - 1;
  while (start < end && Math.abs(pcm[start]) < threshold) start++;
  while (end > start && Math.abs(pcm[end]) < threshold) end--;
  const margin = Math.round((marginMs / 1000) * SAMPLE_RATE);
  start = Math.max(0, start - margin);
  end = Math.min(pcm.length - 1, end + margin);
  if (start === 0 && end === pcm.length - 1) return pcm;
  return pcm.subarray(start, end + 1);
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
