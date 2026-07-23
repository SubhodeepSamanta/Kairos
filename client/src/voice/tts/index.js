import { voiceConfig } from "../config.js";
import { speakableSegments, stripMarkup } from "../markup.js";
import { toSpokenText } from "../spoken.js";
import { createPlayer } from "./playback.js";
import { createKokoroEngine } from "./kokoro.js";
import { createSapiEngine } from "./sapi.js";

const MAX_SPEECH_CHARS = 900;

export const DEFAULT_VOICE = { engine: "kokoro", voice: "af_heart", rate: 1, pitch: 1 };

export function genderOf(voiceId) {
  return /^[a-z]m_/i.test(String(voiceId || "")) ? "male" : "female";
}

function trimForSpeech(text) {
  const clean = toSpokenText(text);
  if (clean.length <= MAX_SPEECH_CHARS) return clean;
  const cut = clean.slice(0, MAX_SPEECH_CHARS);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return lastStop > MAX_SPEECH_CHARS / 2 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

export function createSpeaker({ onStatus, onError, engineFactory, playerFactory = createPlayer } = {}) {
  const player = playerFactory();
  let engine = null;
  let enginePromise = null;
  let generation = 0;

  async function tryEngine(candidate) {
    await candidate.ready(onStatus);
    return candidate;
  }

  async function resolveEngine() {
    if (engineFactory) return tryEngine(engineFactory());
    const preference = voiceConfig.ttsEngine;
    const order = preference === "sapi"
      ? [createSapiEngine()]
      : preference === "kokoro"
        ? [createKokoroEngine()]
        : [createKokoroEngine(), createSapiEngine()];

    let lastError = null;
    for (const candidate of order) {
      try {
        return await tryEngine(candidate);
      } catch (err) {
        lastError = err;
        if (order.length > 1) {
          onStatus?.(`${candidate.name} voice unavailable (${err.message.slice(0, 60)}) — falling back`);
        }
      }
    }
    throw lastError || new Error("no speech engine available");
  }

  async function ensureEngine() {
    if (engine) return engine;
    if (!enginePromise) {
      enginePromise = resolveEngine()
        .then((resolved) => { engine = resolved; return resolved; })
        .catch((err) => { enginePromise = null; throw err; });
    }
    return enginePromise;
  }

  async function voiceIdFor(active, personaVoice) {
    if (active.name === "kokoro") return personaVoice.voice || DEFAULT_VOICE.voice;
    if (active.name === "sapi") return active.pickVoice(genderOf(personaVoice.voice));
    return null;
  }

  return {
    engineName: () => engine?.name || null,
    isSpeaking: () => player.isPlaying(),

    prepare(onProgress) {
      return ensureEngine().then(
        async (active) => {
          if (active.name === "kokoro") {
            await active.synthesize({ text: "hey.", rate: 1, pitch: 1, volume: 1 }, DEFAULT_VOICE.voice).catch(() => {});
          }
          onProgress?.(`voice ready (${active.name})`);
          return true;
        },
        (err) => { onError?.(err); return false; }
      );
    },

    async speak(text, personaVoice = DEFAULT_VOICE) {
      const spoken = trimForSpeech(text);
      if (!spoken) return false;

      const mine = ++generation;
      const stale = () => mine !== generation || player.isCancelled();

      let active;
      try {
        active = await ensureEngine();
      } catch (err) {
        onError?.(err);
        return false;
      }

      const segments = speakableSegments(spoken, {
        rate: personaVoice.rate ?? 1,
        pitch: personaVoice.pitch ?? 1,
        volume: personaVoice.volume ?? 1
      });
      if (!segments.length) return false;

      player.resume();
      const voiceId = await voiceIdFor(active, personaVoice);

      const render = (segment) => {
        if (!segment || segment.type === "pause") return null;
        const pending = active.synthesize(segment, voiceId);
        pending.catch(() => {});
        return pending;
      };

      let pending = render(segments[0]);
      let playedAny = false;

      for (let i = 0; i < segments.length; i++) {
        if (stale()) return false;
        const segment = segments[i];

        if (segment.type === "pause") {
          if (!pending) pending = render(segments[i + 1]);
          await player.pause(segment.ms);
          continue;
        }

        try {
          const wav = await pending;
          pending = render(segments[i + 1]);
          if (stale()) return false;
          if (await player.play(wav)) playedAny = true;
        } catch (err) {
          onError?.(new Error(`could not speak: ${err.message}`));
          return false;
        }
      }
      if (!playedAny && !stale()) {
        onError?.(new Error(`no audio came out${player.lastError() ? ` (${player.lastError()})` : ""} — is the sound device busy?`));
        return false;
      }
      return !stale();
    },

    stop() {
      generation++;
      player.stop();
    }
  };
}

export { stripMarkup };
