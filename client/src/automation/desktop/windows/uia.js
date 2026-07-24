import { sendToBridge } from "./bridge.js";

const MAX_ELEMENTS = 80;
const NAMELESS_OK = new Set(["Edit", "Document", "ComboBox", "Text"]);
const CONTROL_PREFIX = /^ControlType\./;

export function normalizeControl(raw) {
  return String(raw || "").replace(CONTROL_PREFIX, "").trim() || "Unknown";
}

export function normalizeElements(raw, cap = MAX_ELEMENTS) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    if (el.offscreen) continue;
    const control = normalizeControl(el.control);
    const name = String(el.name || "").replace(/\s+/g, " ").trim();
    if (!name && !NAMELESS_OK.has(control)) continue;
    const key = `${control}|${name}|${el.autoId || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const patterns = Array.isArray(el.patterns) ? el.patterns.map(p => String(p).toLowerCase()) : [];
    out.push({
      ref: Number(el.ref),
      name,
      control,
      autoId: el.autoId ? String(el.autoId) : "",
      patterns,
      enabled: el.enabled !== false,
      rect: rectOf(el.rect)
    });
    if (out.length >= cap) break;
  }
  return out;
}

function rectOf(rect) {
  if (!rect || typeof rect !== "object") return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.w);
  const h = Number(rect.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

export function assignIds(elements) {
  return elements.map((el, i) => ({ id: i + 1, ...el }));
}

export async function bridgeRead(timeoutMs) {
  const resp = await sendToBridge({ cmd: "read" }, timeoutMs);
  const window = resp?.window && typeof resp.window === "object"
    ? { title: String(resp.window.title || "").slice(0, 120), app: String(resp.window.app || "").slice(0, 80) }
    : null;
  return { window, elements: assignIds(normalizeElements(resp?.elements)) };
}

export function bridgeInvoke(ref, timeoutMs) {
  return sendToBridge({ cmd: "invoke", ref }, timeoutMs);
}

export function bridgeSetValue(ref, value, timeoutMs) {
  return sendToBridge({ cmd: "setvalue", ref, value }, timeoutMs);
}

export function bridgeToggle(ref, on, timeoutMs) {
  return sendToBridge({ cmd: "toggle", ref, on: on !== false }, timeoutMs);
}

export function bridgeSelect(ref, value, timeoutMs) {
  return sendToBridge({ cmd: "select", ref, value }, timeoutMs);
}

export function bridgeKeys(keys, timeoutMs) {
  return sendToBridge({ cmd: "keys", keys }, timeoutMs);
}
