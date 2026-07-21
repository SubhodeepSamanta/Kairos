import { SAMPLE_RATE } from "./config.js";

const WINDOW_SAMPLES = Math.round(SAMPLE_RATE * 0.04);
const MIN_LAG = Math.floor(SAMPLE_RATE / 400);
const MAX_LAG = Math.floor(SAMPLE_RATE / 70);
const VOICED_CORRELATION = 0.35;
const BASELINE_WEIGHT = 0.2;
const MIN_UTTERANCES_FOR_BASELINE = 3;

function windowPitch(samples, start, length) {
  let bestLag = 0;
  let bestScore = 0;
  for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
    let dot = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i + lag < length; i++) {
      const a = samples[start + i];
      const b = samples[start + i + lag];
      dot += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const score = dot / (Math.sqrt(energyA * energyB) || 1);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return bestScore >= VOICED_CORRELATION && bestLag ? SAMPLE_RATE / bestLag : 0;
}

function windowEnergy(samples, start, length) {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += samples[start + i] * samples[start + i];
  return Math.sqrt(sum / (length || 1));
}

export function analyseProsody(audio) {
  const total = audio.length;
  if (total < WINDOW_SAMPLES * 2) return null;

  const pitches = [];
  const energies = [];
  const voiced = [];

  for (let start = 0; start + WINDOW_SAMPLES <= total; start += WINDOW_SAMPLES) {
    const energy = windowEnergy(audio, start, WINDOW_SAMPLES);
    energies.push(energy);
    const pitch = windowPitch(audio, start, WINDOW_SAMPLES);
    voiced.push(pitch > 0);
    if (pitch > 0) pitches.push(pitch);
  }

  const meanEnergy = energies.reduce((a, b) => a + b, 0) / (energies.length || 1);
  const loudCutoff = meanEnergy * 0.4;
  const quietWindows = energies.filter(e => e < loudCutoff).length;

  let runs = 0;
  for (let i = 1; i < voiced.length; i++) {
    if (voiced[i] && !voiced[i - 1]) runs++;
  }

  const meanPitch = pitches.reduce((a, b) => a + b, 0) / (pitches.length || 1);
  const variance = pitches.length
    ? pitches.reduce((sum, p) => sum + (p - meanPitch) ** 2, 0) / pitches.length
    : 0;
  const durationS = total / SAMPLE_RATE;

  return {
    energy: meanEnergy,
    pitch: pitches.length ? meanPitch : 0,
    pitchRange: Math.sqrt(variance),
    rate: durationS > 0 ? runs / durationS : 0,
    pauseRatio: energies.length ? quietWindows / energies.length : 0,
    voicedRatio: voiced.length ? voiced.filter(Boolean).length / voiced.length : 0,
    durationS
  };
}

function describe(features, baseline) {
  const notes = [];
  const ratio = (value, base) => (base > 0 ? value / base : 1);

  const energyRatio = ratio(features.energy, baseline.energy);
  if (energyRatio < 0.65) notes.push("quieter than usual");
  else if (energyRatio > 1.5) notes.push("louder than usual");

  const rateRatio = ratio(features.rate, baseline.rate);
  if (rateRatio < 0.7) notes.push("slower than usual");
  else if (rateRatio > 1.35) notes.push("faster than usual");

  const pitchRatio = ratio(features.pitch, baseline.pitch);
  if (pitchRatio < 0.9) notes.push("lower pitched");
  else if (pitchRatio > 1.12) notes.push("higher pitched");

  const rangeRatio = ratio(features.pitchRange, baseline.pitchRange);
  if (rangeRatio < 0.6) notes.push("flat, little inflection");
  else if (rangeRatio > 1.6) notes.push("very animated");

  if (features.pauseRatio > baseline.pauseRatio + 0.2) notes.push("hesitant, lots of pauses");

  return notes;
}

export function createProsodyReader() {
  let baseline = null;
  let seen = 0;

  return {
    read(audio, precomputed) {
      const features = precomputed || analyseProsody(audio);
      if (!features || features.voicedRatio < 0.15) return null;

      seen++;
      if (!baseline) {
        baseline = { ...features };
        return null;
      }

      const notes = seen > MIN_UTTERANCES_FOR_BASELINE ? describe(features, baseline) : [];

      for (const key of ["energy", "pitch", "pitchRange", "rate", "pauseRatio"]) {
        baseline[key] = baseline[key] * (1 - BASELINE_WEIGHT) + features[key] * BASELINE_WEIGHT;
      }

      return notes.length ? { tone: notes.join(", "), features } : null;
    },
    baseline: () => baseline,
    reset() {
      baseline = null;
      seen = 0;
    }
  };
}
