import { createVoiceSession } from "./session.js";
import { stripMarkup } from "./markup.js";
import { listInputDevices } from "./capture.js";
import { isStopPhrase, isRepeatPhrase } from "./stopwords.js";
import { deliveryCommand, applyDelivery } from "./controls.js";
import { loadDelivery, saveDelivery, saveVoiceWanted } from "./preferences.js";
import { DEFAULT_VOICE } from "./tts/index.js";

const VOICE_COMMAND = /^\/?(?:voice|stt|tts|talk|listen)$/i;
const VOICE_ON = /^\/?(?:enable|start|activate|turn on)\s+voice$|^\/?voice\s+(?:on|enable|start)$/i;
const VOICE_OFF = /^\/?(?:voice|stt|tts)\s+(?:off|stop|disable)$|^\/?(?:disable|stop|turn off)\s+voice$/i;
const VOICE_DEVICES = /^\/?(?:voice|mic)\s+devices$/i;
const VOICE_TEST = /^\/?(?:voice|mic)\s+test$/i;
const VOICE_AGAIN = /^\/?(?:again|repeat)$/i;

export const LOCAL_COMMANDS = [
  ["voice", "listen and talk out loud"],
  ["voice off", "stop listening"],
  ["voice test", "check she can hear you"],
  ["voice devices", "list microphones"],
  ["again", "say the last reply again"],
  ["slower / faster", "say it out loud — change how fast she talks"],
  ["louder / quieter", "say it out loud — change how loud she is"],
  ["/stop", "stop whatever she is doing"]
];

export function localCommandHelp() {
  const width = Math.max(...LOCAL_COMMANDS.map(([name]) => name.length));
  return LOCAL_COMMANDS.map(([name, help]) => `  ${name.padEnd(width)}  ${help}`).join("\n");
}

export function isVoiceCommand(text) {
  const line = String(text || "").trim();
  return VOICE_COMMAND.test(line) || VOICE_ON.test(line) || VOICE_OFF.test(line)
    || VOICE_DEVICES.test(line) || VOICE_TEST.test(line) || VOICE_AGAIN.test(line);
}

const TEST_SECONDS = 5;

async function runMicTest(line) {
  const { startMicrophone } = await import("./capture.js");
  const { frameEnergy } = await import("./vad.js");
  const { createTranscriber } = await import("./stt.js");
  const { createVad } = await import("./vad.js");
  const { voiceConfig } = await import("./config.js");
  const stt = createTranscriber();
  line("  loading her ears…");
  await stt.ready();

  const ambient = [];
  const quietMic = await startMicrophone({ device: voiceConfig.device, onFrame: f => ambient.push(frameEnergy(f)), onError: () => {} });
  line("  sampling the room — stay quiet…");
  await new Promise(r => setTimeout(r, 1500));
  quietMic.stop();
  const ambientPeak = ambient.length ? Math.max(...ambient) : 0;
  const vad = createVad();
  const trigger = vad.calibrate(ambientPeak);

  const frames = [];
  let peak = 0;
  let sum = 0;

  line(`  say something for ${TEST_SECONDS} seconds — go`);
  const mic = await startMicrophone({
    device: voiceConfig.device,
    onFrame: (f) => {
      frames.push(f);
      const e = frameEnergy(f);
      sum += e;
      if (e > peak) peak = e;
    },
    onError: (err) => line(`  mic: ${err.message}`)
  });

  await new Promise((r) => setTimeout(r, TEST_SECONDS * 1000));
  mic.stop();

  const mean = frames.length ? sum / frames.length : 0;
  const total = frames.reduce((n, f) => n + f.length, 0);
  const pcm = new Int16Array(total);
  let at = 0;
  for (const f of frames) { pcm.set(f, at); at += f.length; }

  line(`  device: ${mic.device}`);
  line(`  room noise: ${ambientPeak.toFixed(0)}   your voice: ${peak.toFixed(0)} loudest, ${mean.toFixed(0)} average`);
  line(`  trigger level: ${trigger}`);

  if (peak < trigger) {
    line(`  your voice never crossed the trigger — she cannot hear you.`);
    line(`  raise the mic volume in Windows, or set VOICE_MAX_FLOOR=${Math.max(60, Math.round(peak * 0.6))}`);
    return;
  }
  if (peak < trigger * 1.6) {
    line(`  that is close to the trigger — speak up, move nearer, or set VOICE_MAX_FLOOR=${Math.round(peak * 0.6)}`);
  }

  const heard = await stt.transcribe(pcm);
  line(heard ? `  she heard: "${heard.text}"` : "  she could not make out any words");
}

export function createVoiceController({ write, sendGoal, onModeChange, onCancel, isBusy, sessionFactory = createVoiceSession }) {
  let session = null;
  let starting = false;
  let testing = false;
  let persona = null;
  let lastSpoken = null;
  let delivery = loadDelivery();
  let speakChain = Promise.resolve();
  let speakEpoch = 0;
  let startPromise = null;

  const line = (text) => { if (text) write(text); };

  const hush = () => {
    speakEpoch++;
    session?.stopSpeaking();
  };

  function effectiveVoice() {
    const base = persona || DEFAULT_VOICE;
    return {
      ...base,
      rate: (base.rate ?? 1) * delivery.rate,
      volume: (base.volume ?? 1) * delivery.volume
    };
  }

  function handleDelivery(kind, text) {
    const result = applyDelivery(delivery, kind);
    if (!result) return;
    delivery = result.delivery;
    saveDelivery(delivery);
    line(`  you: ${text}`);
    if (session?.isRunning()) {
      session.setPersona(effectiveVoice());
      session.speak(result.confirm).catch(() => {});
    } else {
      line(`  ${result.confirm}`);
    }
  }

  function build() {
    return sessionFactory({
      onStatus: (text) => line(text ? `  ${text}` : ""),
      onError: (err) => line(`  voice: ${err.message}`),
      onListening: () => {},
      onTranscript: ({ text, tone }) => {
        const deliver = deliveryCommand(text);
        if (deliver) {
          handleDelivery(deliver, text);
          return;
        }
        if (isRepeatPhrase(text)) {
          line(`  you: ${text}`);
          if (lastSpoken) session?.speak(lastSpoken).catch(() => {});
          else line("  nothing to repeat yet");
          return;
        }
        if (isStopPhrase(text)) {
          hush();
          line(`  you: ${text}`);
          if (isBusy?.()) {
            line("  stopping…");
            onCancel?.();
          }
          return;
        }
        line(`  you: ${text}${tone ? `  (${tone})` : ""}`);
        sendGoal(text, tone);
      }
    });
  }

  return {
    isActive: () => Boolean(session?.isRunning()),

    async handle(input) {
      const text = String(input || "").trim();

      if (VOICE_DEVICES.test(text)) {
        try {
          const devices = await listInputDevices();
          line(devices.length
            ? `  microphones:\n${devices.map(d => `    · ${d}`).join("\n")}`
            : "  no microphones found");
        } catch (err) {
          line(`  voice: ${err.message}`);
        }
        return true;
      }

      if (VOICE_AGAIN.test(text)) {
        if (!lastSpoken) line("  nothing to repeat yet");
        else if (!session?.isRunning()) line(`  ${lastSpoken}`);
        else session.speak(lastSpoken).catch(() => {});
        return true;
      }

      if (VOICE_TEST.test(text)) {
        if (session?.isRunning()) {
          line("  she is already listening — run \"voice off\" first, then \"voice test\"");
          return true;
        }
        if (testing) {
          line("  a mic test is already running");
          return true;
        }
        testing = true;
        try {
          await runMicTest(line);
        } catch (err) {
          line(`  mic test failed: ${err.message}`);
        } finally {
          testing = false;
        }
        return true;
      }

      if (VOICE_OFF.test(text)) {
        saveVoiceWanted(false);
        if (!session?.isRunning()) line("  voice is already off");
        else { session.stop(); onModeChange?.(false); }
        return true;
      }

      const explicitOn = VOICE_ON.test(text);
      if (!VOICE_COMMAND.test(text) && !explicitOn) return false;

      if (session?.isRunning()) {
        if (explicitOn) {
          line("  voice is already on");
          return true;
        }
        saveVoiceWanted(false);
        session.stop();
        onModeChange?.(false);
        return true;
      }
      if (starting) {
        line("  still waking up…");
        return true;
      }

      starting = true;
      try {
        session = session || build();
        session.setPersona(effectiveVoice());
        startPromise = session.start();
        const ok = await startPromise;
        if (ok) saveVoiceWanted(true);
        onModeChange?.(Boolean(ok));
      } finally {
        starting = false;
      }
      return true;
    },

    status() {
      if (starting) return "voice: starting up";
      if (!session?.isRunning()) return "voice: off — type \"voice\" to talk out loud";
      const bits = [session.engineName?.(), session.device?.()].filter(Boolean);
      return `voice: on${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
    },

    setPersona(voice) {
      if (!voice) return;
      persona = voice;
      session?.setPersona(effectiveVoice());
    },

    speak(text) {
      const spoken = stripMarkup(text);
      if (!spoken) return spoken;
      if (!session?.isRunning() && !starting) return spoken;
      lastSpoken = text;
      const epoch = speakEpoch;
      speakChain = speakChain
        .then(async () => {
          if (startPromise) await startPromise.catch(() => {});
          if (epoch === speakEpoch && session?.isRunning()) await session.speak(text);
        })
        .catch((err) => line(`  could not speak: ${err.message}`));
      return spoken;
    },

    interrupt() {
      hush();
    },

    stop() {
      const wasRunning = Boolean(session?.isRunning());
      speakEpoch++;
      session?.stop();
      session = null;
      if (wasRunning) onModeChange?.(false);
    }
  };
}
