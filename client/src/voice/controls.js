const MIN_RATE = 0.6;
const MAX_RATE = 1.6;
const MIN_VOLUME = 0.3;
const MAX_VOLUME = 1;
const RATE_STEP = 0.85;
const VOLUME_STEP = 0.75;

export const DELIVERY_DEFAULT = { rate: 1, volume: 1 };

const PATTERNS = [
  { kind: "slower", re: /^(?:speak|talk) (?:slower|more slowly)$|^slow down$|^slower$|^not so fast$/ },
  { kind: "faster", re: /^(?:speak|talk) faster$|^speed up$|^faster$|^hurry up$/ },
  { kind: "louder", re: /^(?:speak|talk) (?:up|louder)$|^louder$|^speak up$|^i can'?t hear you$/ },
  { kind: "quieter", re: /^(?:speak|talk) (?:quieter|softer)$|^quieter$|^softer$|^not so loud$|^keep it down$/ },
  { kind: "reset", re: /^(?:normal|normal speed|reset(?: your)? voice|talk normally|speak normally|back to normal)$/ }
];

function bare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deliveryCommand(text) {
  const clean = bare(text);
  if (!clean || clean.split(" ").length > 4) return null;
  for (const { kind, re } of PATTERNS) {
    if (re.test(clean)) return kind;
  }
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const CONFIRM = {
  slower: "okay, slower.",
  faster: "okay, a bit faster.",
  louder: "okay, louder.",
  quieter: "okay, softer.",
  reset: "okay, back to normal."
};

export function applyDelivery(current = DELIVERY_DEFAULT, kind) {
  const now = { rate: current.rate ?? 1, volume: current.volume ?? 1 };
  let next = now;

  if (kind === "slower") next = { ...now, rate: clamp(now.rate * RATE_STEP, MIN_RATE, MAX_RATE) };
  else if (kind === "faster") next = { ...now, rate: clamp(now.rate / RATE_STEP, MIN_RATE, MAX_RATE) };
  else if (kind === "quieter") next = { ...now, volume: clamp(now.volume * VOLUME_STEP, MIN_VOLUME, MAX_VOLUME) };
  else if (kind === "louder") next = { ...now, volume: clamp(now.volume / VOLUME_STEP, MIN_VOLUME, MAX_VOLUME) };
  else if (kind === "reset") next = { ...DELIVERY_DEFAULT };
  else return null;

  const changed = next.rate !== now.rate || next.volume !== now.volume;
  const confirm = kind === "reset" || changed
    ? CONFIRM[kind]
    : kind === "slower" || kind === "faster"
      ? "that's about as far as I go with the speed."
      : "that's about as far as I go with the volume.";

  return { delivery: next, confirm };
}
