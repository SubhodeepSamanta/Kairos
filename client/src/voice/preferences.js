import fs from "fs";
import path from "path";
import { DELIVERY_DEFAULT } from "./controls.js";

const persisting = process.env.NODE_ENV !== "test";
const file = () => path.join(process.cwd(), "data", "voice.json");

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
  try {
    return sanitizeDelivery(JSON.parse(fs.readFileSync(file(), "utf8"))) || { ...DELIVERY_DEFAULT };
  } catch {
    return { ...DELIVERY_DEFAULT };
  }
}

export function saveDelivery(delivery) {
  const clean = sanitizeDelivery(delivery);
  if (!persisting || !clean) return;
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    const tmp = `${file()}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(clean), "utf8");
    fs.renameSync(tmp, file());
  } catch {}
}
