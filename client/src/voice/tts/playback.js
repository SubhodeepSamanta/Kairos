import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const PS_ARGS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"];

let counter = 0;

function tempWavPath() {
  counter += 1;
  return path.join(os.tmpdir(), `kairos-voice-${process.pid}-${counter}.wav`);
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function createPlayer({ spawnFn = spawn } = {}) {
  let active = null;
  let pending = null;
  let cancelled = false;
  let lastError = null;

  return {
    isPlaying: () => active !== null || pending !== null,
    isCancelled: () => cancelled,
    lastError: () => lastError,

    async play(wavBuffer) {
      if (cancelled) return false;
      const file = tempWavPath();
      await fs.promises.writeFile(file, wavBuffer);
      if (cancelled) {
        await fs.promises.unlink(file).catch(() => {});
        return false;
      }

      return new Promise((resolve) => {
        const proc = spawnFn("powershell.exe", [
          ...PS_ARGS,
          `$player = New-Object System.Media.SoundPlayer ${psQuote(file)}; $player.PlaySync(); $player.Dispose()`
        ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });

        active = proc;
        let stderr = "";
        proc.stderr?.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-400); });

        const finish = (completed, why) => {
          if (active === proc) active = null;
          if (!completed && !cancelled) lastError = why || "playback failed";
          fs.promises.unlink(file).catch(() => {});
          resolve(completed);
        };

        proc.on("error", (err) => finish(false, err.message));
        proc.on("close", (code) => finish(code === 0, code === 0 ? null : (stderr.trim().split(/\r?\n/).pop() || `player exited ${code}`)));
      });
    },

    async pause(ms) {
      if (cancelled || !(ms > 0)) return;
      await new Promise((resolve) => {
        pending = { resolve, timer: setTimeout(() => { pending = null; resolve(); }, ms) };
      });
    },

    stop() {
      cancelled = true;
      if (pending) {
        clearTimeout(pending.timer);
        const { resolve } = pending;
        pending = null;
        resolve();
      }
      if (active) {
        const proc = active;
        active = null;
        try { proc.kill("SIGKILL"); } catch {}
      }
    },

    resume() {
      cancelled = false;
    }
  };
}
