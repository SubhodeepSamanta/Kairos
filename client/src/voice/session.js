import { voiceConfig } from "./config.js";
import { startMicrophone } from "./capture.js";
import { createVad } from "./vad.js";
import { createProsodyReader } from "./prosody.js";
import { createTranscriber } from "./stt.js";
import { createWakeGate } from "./wake.js";
import { createSpeaker, DEFAULT_VOICE } from "./tts/index.js";

const BARGE_IN_GRACE_MS = 400;

export function createVoiceSession({
  onTranscript,
  onStatus,
  onError,
  onListening,
  onLevel,
  speakerFactory = createSpeaker,
  transcriberFactory = createTranscriber,
  microphoneFactory = startMicrophone
} = {}) {
  const vad = createVad();
  const prosody = createProsodyReader();
  const gate = createWakeGate();
  const stt = transcriberFactory();
  const speaker = speakerFactory({ onStatus, onError });

  let mic = null;
  let running = false;
  let busy = false;
  let persona = DEFAULT_VOICE;
  let speakingUntil = 0;
  let bargedIn = false;

  const status = (text) => onStatus?.(text);
  const fail = (err) => onError?.(err instanceof Error ? err : new Error(String(err)));

  async function handleUtterance(pcm) {
    if (busy) return;
    busy = true;
    try {
      const heard = await stt.transcribe(pcm);
      if (!heard) return;

      const decision = gate.consider(heard.text);
      if (decision.action === "ignore") return;

      if (decision.action === "listen") {
        onListening?.(true);
        status("listening…");
        return;
      }

      const tone = prosody.read(pcm);
      onTranscript?.({
        text: decision.command,
        heard: heard.text,
        viaWake: decision.viaWake,
        tone: tone?.tone || null
      });
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  function onFrame(frame) {
    onLevel?.(vad.level());

    if (speaker.isSpeaking()) {
      if (Date.now() < speakingUntil) return;
      const interrupt = vad.push(frame);
      if (interrupt?.type === "speech_start") {
        bargedIn = true;
        speaker.stop();
        vad.setBargeIn(false);
        status("okay, go ahead");
      }
      return;
    }

    const event = vad.push(frame);
    if (!event) return;

    if (event.type === "speech_start") {
      status(gate.isOpen() ? "listening…" : "");
      return;
    }
    if (event.type === "speech_end") {
      status("thinking…");
      handleUtterance(event.audio);
    }
  }

  return {
    isRunning: () => running,
    engineName: () => speaker.engineName(),
    device: () => mic?.device || null,

    setPersona(voice) {
      persona = voice || DEFAULT_VOICE;
    },

    async speak(text) {
      if (!voiceConfig.speak || !text) return false;
      speakingUntil = Date.now() + BARGE_IN_GRACE_MS;
      bargedIn = false;
      vad.setBargeIn(true);
      try {
        return await speaker.speak(text, persona);
      } finally {
        vad.setBargeIn(false);
        if (!bargedIn) vad.reset();
        bargedIn = false;
      }
    },

    stopSpeaking() {
      speaker.stop();
    },

    async start() {
      if (running) return true;
      status("waking up her ears…");

      try {
        await stt.ready(status);
      } catch (err) {
        fail(new Error(`Could not load the listening model: ${err.message}`));
        return false;
      }

      speaker.prepare(status).catch(() => {});

      try {
        mic = await microphoneFactory({
          device: voiceConfig.device,
          onFrame,
          onError: fail
        });
      } catch (err) {
        fail(err);
        return false;
      }

      running = true;
      status(voiceConfig.requireWake
        ? `listening on ${mic.device} — say "Kairos" to start`
        : `listening on ${mic.device}`);
      return true;
    },

    stop() {
      if (!running) return;
      running = false;
      speaker.stop();
      mic?.stop();
      mic = null;
      vad.reset();
      gate.close();
      status("voice off");
    }
  };
}
