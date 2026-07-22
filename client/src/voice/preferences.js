import fs from "fs";
import path from "path";
import { DELIVERY_DEFAULT } from "./controls.js";

const persisting = process.env.NODE_ENV !== "test";
const file = () => path.join(process.cwd(), "data", "voice.json");

function readAll() {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(patch) {
  if (!persisting) return;
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    const next = { ...readAll(), ...patch };
    const tmp = `${file()}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next), "utf8");
    fs.renameSync(tmp, file());
  } catch {}
}

export function sanitizeDelivery(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rate = Number(raw.rate);
  const volume = Number(raw.volume);
  if (!Number.isFinite(rate) || !Number.isFinite(volume)) return null;
  return {
    rate: Math.min(1.6, Math.max(0.6, rate)),
    volume: Math.min(1, Math.max(0.3, volume))
  };
}

export function loadDelivery() {
  if (!persisting) return { ...DELIVERY_DEFAULT };
  return sanitizeDelivery(readAll()) || { ...DELIVERY_DEFAULT };
}

export function saveDelivery(delivery) {
  const clean = sanitizeDelivery(delivery);
  if (!clean) return;
  writeAll(clean);
}

export function voiceWanted() {
  if (!persisting) return false;
  return readAll().enabled === true;
}

export function saveVoiceWanted(on) {
  writeAll({ enabled: Boolean(on) });
}
