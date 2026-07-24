const MODS = { ctrl: "^", control: "^", alt: "%", shift: "+", win: "", cmd: "", meta: "" };

const NAMED = {
  enter: "{ENTER}", return: "{ENTER}", tab: "{TAB}", esc: "{ESC}", escape: "{ESC}",
  del: "{DEL}", delete: "{DEL}", backspace: "{BACKSPACE}", bksp: "{BACKSPACE}",
  space: " ", up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}",
  home: "{HOME}", end: "{END}", pageup: "{PGUP}", pagedown: "{PGDN}",
  insert: "{INSERT}", ins: "{INSERT}"
};

const SENDKEYS_SPECIAL = new Set(["+", "^", "%", "~", "(", ")", "{", "}", "[", "]"]);

function keyToken(key) {
  const low = key.toLowerCase();
  if (NAMED[low] !== undefined) return NAMED[low];
  if (/^f\d{1,2}$/.test(low)) return `{${low.toUpperCase()}}`;
  if (key.length === 1) {
    if (SENDKEYS_SPECIAL.has(key)) return `{${key}}`;
    return key.toLowerCase();
  }
  return `{${key.toUpperCase()}}`;
}

export function toSendKeys(combo) {
  const raw = String(combo || "").trim();
  if (!raw) return "";
  const parts = raw.split("+").map(p => p.trim()).filter(Boolean);
  if (!parts.length) return "";
  const key = parts.pop();
  let prefix = "";
  for (const m of parts) {
    const mod = MODS[m.toLowerCase()];
    if (mod !== undefined) prefix += mod;
  }
  return prefix + keyToken(key);
}
