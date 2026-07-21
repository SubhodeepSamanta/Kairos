import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const PS_ARGS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"];
const TIMEOUT_MS = 20000;

let counter = 0;

function tempFile(extension) {
  counter += 1;
  return path.join(os.tmpdir(), `kairos-sapi-${process.pid}-${counter}.${extension}`);
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile("powershell.exe", [...PS_ARGS, script], { timeout: TIMEOUT_MS, windowsHide: true },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout))));
  });
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function percent(multiplier) {
  const delta = Math.round(((multiplier ?? 1) - 1) * 100);
  const clamped = Math.max(-50, Math.min(100, delta));
  return `${clamped >= 0 ? "+" : ""}${clamped}%`;
}

export function buildSsml(segment, voiceName) {
  const inner = `<prosody rate="${percent(segment.rate)}" pitch="${percent(segment.pitch)}" volume="${Math.round(Math.max(0, Math.min(1, segment.volume ?? 1)) * 100)}">${escapeXml(segment.text)}</prosody>`;
  const voiced = voiceName ? `<voice name="${escapeXml(voiceName)}">${inner}</voice>` : inner;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">${voiced}</speak>`;
}

export function createSapiEngine() {
  let installed = null;

  async function listVoices() {
    if (installed) return installed;
    const out = await runPowerShell(
      "Add-Type -AssemblyName System.Speech; " +
      "(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | " +
      "ForEach-Object { $_.VoiceInfo.Name + '|' + $_.VoiceInfo.Gender }"
    );
    installed = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((line) => {
      const [name, gender] = line.split("|");
      return { name, gender: (gender || "").toLowerCase() };
    });
    return installed;
  }

  return {
    name: "sapi",

    async ready() {
      const voices = await listVoices();
      if (!voices.length) throw new Error("no Windows speech voices are installed");
      return true;
    },

    async pickVoice(preferGender) {
      const voices = await listVoices();
      if (!voices.length) return null;
      const wanted = preferGender === "male" ? "male" : "female";
      return (voices.find(v => v.gender === wanted) || voices[0]).name;
    },

    async synthesize(segment, voiceName) {
      const ssmlFile = tempFile("xml");
      const wavFile = tempFile("wav");
      await fs.promises.writeFile(ssmlFile, buildSsml(segment, voiceName), "utf8");

      try {
        await runPowerShell(
          "Add-Type -AssemblyName System.Speech; " +
          "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; " +
          `$s.SetOutputToWaveFile(${psQuote(wavFile)}); ` +
          `$s.SpeakSsml([IO.File]::ReadAllText(${psQuote(ssmlFile)})); ` +
          "$s.Dispose()"
        );
        return await fs.promises.readFile(wavFile);
      } finally {
        fs.promises.unlink(ssmlFile).catch(() => {});
        fs.promises.unlink(wavFile).catch(() => {});
      }
    }
  };
}
