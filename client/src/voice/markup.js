const TAG = /\[(pause|smile|soft|fast|slow|warm)(?::(\d{1,5}))?\]/gi;

const STYLES = {
  smile: { rate: 1.06, pitch: 1.05 },
  soft: { rate: 0.92, pitch: 0.97, volume: 0.75 },
  fast: { rate: 1.18, pitch: 1.02 },
  slow: { rate: 0.88, pitch: 1 },
  warm: { rate: 0.97, pitch: 1.02 }
};

const MAX_PAUSE_MS = 2000;

export function stripMarkup(text) {
  return String(text || "")
    .replace(TAG, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trim();
}

export function hasMarkup(text) {
  TAG.lastIndex = 0;
  return TAG.test(String(text || ""));
}

export function parseDelivery(text, base = {}) {
  const source = String(text || "");
  const baseStyle = { rate: base.rate ?? 1, pitch: base.pitch ?? 1, volume: base.volume ?? 1 };
  const segments = [];

  let active = { ...baseStyle };
  let cursor = 0;

  const pushSpeech = (raw) => {
    const clean = raw.replace(/\s+/g, " ").trim();
    if (!clean) return;
    const last = segments[segments.length - 1];
    if (last && last.type === "speech" && sameStyle(last, active)) {
      last.text = `${last.text} ${clean}`;
      return;
    }
    segments.push({ type: "speech", text: clean, ...active });
  };

  TAG.lastIndex = 0;
  let match;
  while ((match = TAG.exec(source)) !== null) {
    pushSpeech(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const name = match[1].toLowerCase();
    if (name === "pause") {
      const ms = Math.min(MAX_PAUSE_MS, Number(match[2]) || 300);
      const last = segments[segments.length - 1];
      if (last && last.type === "pause") last.ms = Math.min(MAX_PAUSE_MS, last.ms + ms);
      else segments.push({ type: "pause", ms });
      continue;
    }
    active = applyStyle(baseStyle, STYLES[name]);
  }

  pushSpeech(source.slice(cursor));

  while (segments.length && segments[segments.length - 1].type === "pause") segments.pop();
  return segments;
}

function applyStyle(base, style) {
  if (!style) return { ...base };
  return {
    rate: base.rate * (style.rate ?? 1),
    pitch: base.pitch * (style.pitch ?? 1),
    volume: base.volume * (style.volume ?? 1)
  };
}

function sameStyle(a, b) {
  return a.rate === b.rate && a.pitch === b.pitch && a.volume === b.volume;
}

export function speakableSegments(text, base = {}) {
  try {
    const segments = parseDelivery(text, base);
    if (segments.some(s => s.type === "speech")) return segments;
  } catch {}
  const plain = stripMarkup(text);
  return plain ? [{ type: "speech", text: plain, rate: base.rate ?? 1, pitch: base.pitch ?? 1, volume: base.volume ?? 1 }] : [];
}
