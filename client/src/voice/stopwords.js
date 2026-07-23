import { voiceConfig } from "./config.js";

const STOP_PHRASES = [
  /^stop$/,
  /^stop it$/,
  /^stop stop$/,
  /^stop please$/,
  /^please stop$/,
  /^cancel$/,
  /^cancel that$/,
  /^cancel it$/,
  /^never ?mind$/,
  /^nevermind$/,
  /^forget it$/,
  /^forget that$/,
  /^wait stop$/,
  /^no stop$/,
  /^abort$/,
  /^quit that$/,
  /^shut up$/,
  /^be quiet$/,
  /^enough$/,
  /^that's enough$/
];

const REPEAT_PHRASES = [
  /^again$/,
  /^repeat$/,
  /^repeat that$/,
  /^repeat it$/,
  /^say that again$/,
  /^say it again$/,
  /^what did you say$/,
  /^what was that$/,
  /^come again$/,
  /^sorry what$/,
  /^i missed that$/
];

function bare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripWake(text) {
  const words = text.split(" ");
  while (words.length > 1 && voiceConfig.wakeWords.includes(words[0])) words.shift();
  return words.join(" ");
}

export function isRepeatPhrase(text) {
  const clean = bare(text);
  if (!clean || clean.split(" ").length > 4) return false;
  return REPEAT_PHRASES.some(p => p.test(clean));
}

export function isStopPhrase(text) {
  const clean = stripWake(bare(text));
  if (!clean || clean.split(" ").length > 3) return false;
  return STOP_PHRASES.some(p => p.test(clean));
}
