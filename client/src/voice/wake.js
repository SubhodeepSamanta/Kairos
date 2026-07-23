import { voiceConfig } from "./config.js";

const LEAD_WORDS = 3;
const FILLER = /^(?:hey|hi|hello|ok|okay|yo|um|uh|so)$/;

export function normaliseWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/'s\b/g, "s")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function editDistance(a, b) {
  if (a === b) return 0;
  const rows = a.length + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i < rows; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1]
        : 1 + Math.min(previous[j - 1], previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[b.length];
}

function tolerance(word) {
  if (word.length <= 4) return 0;
  if (word.length <= 7) return 1;
  return 2;
}

export function phoneticKey(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/[hyw]/g, "")
    .replace(/[cqgj]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/v/g, "f")
    .replace(/b/g, "p")
    .replace(/d/g, "t")
    .replace(/[aeiou]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function matchesWake(candidate, wakeWords) {
  if (!candidate) return false;
  for (const wake of wakeWords) {
    const allowed = Math.min(tolerance(wake), tolerance(candidate));
    if (editDistance(candidate, wake) <= allowed) return true;
    const key = phoneticKey(wake);
    const candidateKey = phoneticKey(candidate);
    if (key.length >= 3 && candidateKey === key) return true;
    if (key.length >= 3 && candidateKey.length >= 4 && candidateKey[0] === key[0]
      && editDistance(candidateKey, key) <= 1) return true;
  }
  return false;
}

export function detectWake(text, wakeWords = voiceConfig.wakeWords) {
  const words = normaliseWords(text);
  if (!words.length) return { matched: false, command: "" };

  const limit = Math.min(LEAD_WORDS, words.length);
  for (let i = 0; i < limit; i++) {
    if (i > 0 && !FILLER.test(words[i - 1])) break;

    if (matchesWake(words[i], wakeWords)) {
      return { matched: true, command: words.slice(i + 1).join(" ") };
    }
    if (i + 1 < words.length && matchesWake(words[i] + words[i + 1], wakeWords)) {
      return { matched: true, command: words.slice(i + 2).join(" ") };
    }
  }
  return { matched: false, command: "" };
}

export function createWakeGate({ requireWake = voiceConfig.requireWake, followUpMs = voiceConfig.followUpMs, now = () => Date.now() } = {}) {
  let openUntil = 0;

  return {
    isOpen: () => now() < openUntil,
    open() { openUntil = now() + followUpMs; },
    close() { openUntil = 0; },

    consider(transcript) {
      const text = String(transcript || "").trim();
      if (!text) return { action: "ignore" };

      const wake = detectWake(text);

      if (wake.matched) {
        if (!wake.command) {
          openUntil = now() + followUpMs;
          return { action: "listen", command: "" };
        }
        openUntil = now() + followUpMs;
        return { action: "send", command: wake.command, viaWake: true };
      }

      if (!requireWake || now() < openUntil) {
        openUntil = now() + followUpMs;
        return { action: "send", command: text, viaWake: false };
      }
      return { action: "ignore" };
    }
  };
}
