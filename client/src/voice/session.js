import { voiceConfig, vadConfig, msToFrames } from "./config.js";
import { startMicrophone } from "./capture.js";
import { createVad, frameEnergy } from "./vad.js";
import { createProsodyReader, analyseProsody } from "./prosody.js";
import { createTranscriber } from "./stt.js";
import { createWakeGate } from "./wake.js";
import { createSpeaker, DEFAULT_VOICE } from "./tts/index.js";

const CALIBRATION_TIMEOUT_MS = 6000;
const ECHO_LEARN_MS = 400;
const ECHO_HEADROOM = 1.5;
const MIC_RETRIES = 3;

export function createVoiceSession({
  onTranscript,
  onStatus,
  onError,
  onListening,
  onLevel,
  speakerFactory = createSpeaker,
  transcriberFactory = createTranscriber,
  microphoneFactory = startMicrophone,
  calibrationMs = vadConfig.calibrationMs,
  requireWake = voiceConfig.requireWake,
  micRetryDelayMs = 1500
} = {}) {
  const vad = createVad();
  const prosody = createProsodyReader();
  const gate = createWakeGate({ requireWake });
  const stt = transcriberFactory();
  const speaker = speakerFactory({ onStatus, onError });

  let mic = null;
  let micWanted = false;
  let micRetries = 0;
  let running = false;
  let busy = false;
  let persona = DEFAULT_VOICE;
  let bargedIn = false;
  let replying = false;
  let echoLearnStart = 0;
  let echoPeak = 0;
  let bargeRun = 0;
  let calibrating = false;
  let ambientPeak = 0;
  let ambientFrames = 0;
  let queued = null;

  const status = (text) => onStatus?.(text);
  const fail = (err) => onError?.(err instanceof Error ? err : new Error(String(err)));

  const idle = () => status("");

  async function openMic() {
    mic = await microphoneFactory({
      device: voiceConfig.device,
      onFrame,
      onError: onMicError
    });
  }

  function onMicError(err) {
    if (!micWanted) return;
    fail(err);
    mic?.stop();
    mic = null;
    if (micRetries >= MIC_RETRIES) {
      shutdown();
      status(`the microphone kept failing — voice is off. check it, then say "voice" to try again`);
      return;
    }
    micRetries++;
    vad.reset();
    status("the microphone dropped — reopening…");
    setTimeout(() => {
      if (!micWanted) return;
      openMic()
        .then(() => status("microphone is back — just talk"))
        .catch((e) => onMicError(e));
    }, micRetryDelayMs);
  }

  function shutdown() {
    if (!running && !micWanted) return;
    running = false;
    micWanted = false;
    queued = null;
    speaker.stop();
    mic?.stop();
    mic = null;
    vad.reset();
    gate.close();
    status("voice off");
  }

  function waitForAmbient(targetFrames) {
    const deadline = Date.now() + CALIBRATION_TIMEOUT_MS;
    return new Promise((resolve) => {
      const tick = () => {
        if (!micWanted || ambientFrames >= targetFrames || Date.now() > deadline) resolve();
        else setTimeout(tick, 40);
      };
      tick();
    });
  }

  function enqueue(pcm) {
    if (!running) return;
    if (busy) {
      queued = pcm;
      return;
    }
    handleUtterance(pcm);
  }

  async function handleUtterance(pcm) {
    busy = true;
    try {
      if (!running) return;
      const voiced = analyseProsody(pcm);
      if (!voiced || voiced.voicedRatio < vadConfig.minVoicedRatio) {
        idle();
        return;
      }

      if (frameEnergy(pcm) < vad.floor() * vadConfig.speechSnr) {
        idle();
        return;
      }

      const heard = await stt.transcribe(pcm);
      if (!running) return;
      if (!heard) {
        status("didn't catch that");
        idle();
        return;
      }

      const decision = gate.consider(heard.text);
      if (decision.action === "ignore") {
        status(`heard "${heard.text}" — say "Kairos" first`);
        idle();
        return;
      }

      if (decision.action === "listen") {
        onListening?.(true);
        status("listening…");
        return;
      }

      const tone = prosody.read(pcm, voiced);
      onTranscript?.({
        text: decision.command,
        heard: heard.text,
        viaWake: decision.viaWake,
        tone: tone?.tone || null
      });
    } catch (err) {
      fail(err);
      idle();
    } finally {
      busy = false;
      if (queued) {
        const next = queued;
        queued = null;
        setImmediate(() => enqueue(next));
      }
    }
  }

  function onFrame(frame) {
    micRetries = 0;
    const level = frameEnergy(frame);
    if (calibrating) {
      if (level > ambientPeak) ambientPeak = level;
      ambientFrames++;
      return;
    }
    onLevel?.(level);

    if ((replying || speaker.isSpeaking()) && !bargedIn) {
      if (!echoLearnStart) {
        if (!speaker.isSpeaking()) return;
        echoLearnStart = Date.now();
      }
      if (Date.now() - echoLearnStart <= ECHO_LEARN_MS) {
        if (level > echoPeak) echoPeak = level;
        return;
      }

      const gate = Math.max(vad.floor() * vadConfig.bargeInRatio, echoPeak * ECHO_HEADROOM);
      if (level > gate) {
        bargeRun++;
        if (bargeRun >= msToFrames(vadConfig.bargeInMs)) {
          bargedIn = true;
          bargeRun = 0;
          speaker.stop();
          status("okay, go ahead");
        }
      } else {
        bargeRun = 0;
        if (level > echoPeak) echoPeak = level;
      }
      return;
    }

    const event = vad.push(frame);
    if (!event) return;

    if (event.type === "speech_end") {
      status("thinking…");
      enqueue(event.audio);
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
      bargedIn = false;
      replying = true;
      echoLearnStart = 0;
      echoPeak = 0;
      bargeRun = 0;
      try {
        return await speaker.speak(text, persona);
      } finally {
        replying = false;
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

      await speaker.prepare(status).catch(() => {});

      micWanted = true;
      micRetries = 0;
      try {
        await openMic();
      } catch (err) {
        micWanted = false;
        fail(err);
        return false;
      }

      if (calibrationMs > 0) {
        calibrating = true;
        ambientPeak = 0;
        ambientFrames = 0;
        status("listening to the room for a moment — stay quiet…");
        await waitForAmbient(msToFrames(calibrationMs));
        calibrating = false;
        if (!micWanted) return false;
        if (ambientFrames > 0) {
          const floor = vad.calibrate(ambientPeak);
          status(`room noise ${ambientPeak.toFixed(0)} · speak above ${floor}`);
          if (floor >= vadConfig.maxFloor) {
            status(`the room sounded loud while I calibrated — if she cannot hear you, run "voice test"`);
          }
        } else {
          status("could not sample the room — using the default trigger level");
        }
      }

      if (!micWanted) return false;
      if (!mic) {
        micWanted = false;
        fail(new Error(`the microphone dropped while I was getting ready — say "voice" to try again`));
        return false;
      }

      running = true;
      status(requireWake
        ? `listening on ${mic.device} — say "Kairos" to start`
        : `listening on ${mic.device} — just talk`);
      return true;
    },

    stop() {
      shutdown();
    }
  };
}
