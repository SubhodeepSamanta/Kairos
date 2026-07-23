import { spawn } from "child_process";
import fs from "fs";
import { SAMPLE_RATE, FRAME_SAMPLES, BYTES_PER_SAMPLE } from "./config.js";

const FRAME_BYTES = FRAME_SAMPLES * BYTES_PER_SAMPLE;

let ffmpegPathPromise = null;

export async function ffmpegPath() {
  if (!ffmpegPathPromise) {
    ffmpegPathPromise = import("ffmpeg-static")
      .then(mod => mod.default || mod)
      .catch(() => null);
  }
  const resolved = process.env.FFMPEG_PATH || (await ffmpegPathPromise);
  if (!resolved) {
    throw new Error("ffmpeg is missing — run: npm install ffmpeg-static (listening needs it; speaking does not)");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `ffmpeg was not downloaded to ${resolved}. Run "node node_modules/ffmpeg-static/install.js" in client/, ` +
      `or install ffmpeg yourself and set FFMPEG_PATH. Speaking still works without it.`
    );
  }
  return resolved;
}

function parseDeviceList(stderr) {
  const audio = [];
  let inAudioSection = false;

  for (const rawLine of String(stderr).split(/\r?\n/)) {
    const line = rawLine.replace(/^\[[^\]]*\]\s*/, "").trim();
    if (/DirectShow audio devices/i.test(line)) { inAudioSection = true; continue; }
    if (/DirectShow video devices/i.test(line)) { inAudioSection = false; continue; }
    if (/^Alternative name/i.test(line)) continue;

    const quoted = line.match(/"([^"]+)"/);
    if (!quoted) continue;
    if (/\(audio\)/i.test(line) || inAudioSection) audio.push(quoted[1]);
  }
  return [...new Set(audio)];
}

export async function listInputDevices() {
  const bin = await ffmpegPath();
  return new Promise((resolve) => {
    const proc = spawn(bin, ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"]);
    let stderr = "";
    proc.stderr.on("data", chunk => { stderr += chunk.toString(); });
    proc.on("error", () => resolve([]));
    proc.on("close", () => resolve(parseDeviceList(stderr)));
  });
}

export async function resolveDevice(preferred) {
  const devices = await listInputDevices();
  if (!devices.length) {
    throw new Error("No microphone found. Check Windows sound settings and microphone privacy permissions.");
  }
  if (!preferred) return devices[0];

  const wanted = String(preferred).toLowerCase();
  const match = devices.find(d => d.toLowerCase() === wanted)
    || devices.find(d => d.toLowerCase().includes(wanted));
  if (match) return match;

  throw new Error(`Microphone "${preferred}" not found. Available: ${devices.join(" | ")}`);
}

export async function startMicrophone({ device, onFrame, onError } = {}) {
  const bin = await ffmpegPath();
  const name = await resolveDevice(device);

  const proc = spawn(bin, [
    "-hide_banner", "-loglevel", "error",
    "-f", "dshow",
    "-audio_buffer_size", "50",
    "-i", `audio=${name}`,
    "-ar", String(SAMPLE_RATE),
    "-ac", "1",
    "-af", "highpass=f=70",
    "-f", "s16le",
    "-"
  ]);

  let carry = Buffer.alloc(0);
  let stopped = false;

  proc.stdout.on("data", (chunk) => {
    if (stopped) return;
    carry = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    let offset = 0;
    while (carry.length - offset >= FRAME_BYTES) {
      const frame = new Int16Array(FRAME_SAMPLES);
      for (let i = 0; i < FRAME_SAMPLES; i++) {
        frame[i] = carry.readInt16LE(offset + i * BYTES_PER_SAMPLE);
      }
      offset += FRAME_BYTES;
      try { onFrame?.(frame); } catch (err) { onError?.(err); }
    }
    carry = offset ? carry.subarray(offset) : carry;
  });

  let stderr = "";
  proc.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-800); });

  proc.on("error", (err) => {
    if (!stopped) onError?.(new Error(`Could not start the microphone: ${err.message}`));
  });

  proc.on("close", (code) => {
    if (stopped || code === 0 || code === null) return;
    onError?.(new Error(`Microphone stopped unexpectedly${stderr ? `: ${stderr.trim().split(/\r?\n/).pop()}` : ""}`));
  });

  return {
    device: name,
    stop() {
      if (stopped) return;
      stopped = true;
      try { proc.kill("SIGKILL"); } catch {}
    }
  };
}

export const __testing = { parseDeviceList };
