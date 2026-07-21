import { createVoiceSession } from "./session.js";
import { stripMarkup } from "./markup.js";
import { listInputDevices } from "./capture.js";

const VOICE_COMMAND = /^\/?(?:voice|stt|tts|talk|listen)$/i;
const VOICE_OFF = /^\/?(?:voice|stt|tts)\s+(?:off|stop)$/i;
const VOICE_DEVICES = /^\/?(?:voice|mic)\s+devices$/i;
const VOICE_TEST = /^\/?(?:voice|mic)\s+test$/i;

export function isVoiceCommand(text) {
  const line = String(text || "").trim();
  return VOICE_COMMAND.test(line) || VOICE_OFF.test(line)
    || VOICE_DEVICES.test(line) || VOICE_TEST.test(line);
}

const TEST_SECONDS = 5;

async function runMicTest(line) {
  const { startMicrophone } = await import("./capture.js");
  const { frameEnergy } = await import("./vad.js");
  const { createTranscriber } = await import("./stt.js");
  const { vadConfig } = await import("./config.js");

  const stt = createTranscriber();
  line("  loading her ears…");
  await stt.ready();

  const frames = [];
  let peak = 0;
  let sum = 0;

  line(`  say something for ${TEST_SECONDS} seconds — go`);
  const mic = await startMicrophone({
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
  line(`  loudest: ${peak.toFixed(0)}   average: ${mean.toFixed(0)}   trigger level: ${vadConfig.absoluteFloor}`);

  if (peak < vadConfig.absoluteFloor) {
    line(`  your voice never crossed the trigger level — she cannot hear you.`);
    line(`  raise the mic volume in Windows, or lower it with VOICE_ABS_FLOOR=${Math.max(20, Math.round(peak / 2))}`);
    return;
  }

  const heard = await stt.transcribe(pcm);
  line(heard ? `  she heard: "${heard.text}"` : "  she could not make out any words");
}

export function createVoiceController({ write, sendGoal, sessionFactory = createVoiceSession }) {
  let session = null;
  let starting = false;

  const line = (text) => { if (text) write(text); };

  function build() {
    return sessionFactory({
      onStatus: (text) => line(text ? `  ${text}` : ""),
      onError: (err) => line(`  voice: ${err.message}`),
      onListening: () => {},
      onTranscript: ({ text, tone }) => {
        line(`  you: ${text}${tone ? `  (${tone})` : ""}`);
        sendGoal(tone ? `${text}\n[voice tone: ${tone}]` : text);
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

      if (VOICE_TEST.test(text)) {
        await runMicTest(line);
        return true;
      }

      if (VOICE_OFF.test(text)) {
        if (!session?.isRunning()) line("  voice is already off");
        else session.stop();
        return true;
      }

      if (!VOICE_COMMAND.test(text)) return false;

      if (session?.isRunning()) {
        session.stop();
        return true;
      }
      if (starting) {
        line("  still waking up…");
        return true;
      }

      starting = true;
      try {
        session = session || build();
        await session.start();
      } finally {
        starting = false;
      }
      return true;
    },

    setPersona(voice) {
      session?.setPersona(voice);
    },

    speak(text) {
      const spoken = stripMarkup(text);
      if (!spoken) return spoken;
      if (!session?.isRunning()) {
        if (starting) line("  (voice is still starting — not spoken)");
        return spoken;
      }
      session.speak(text).catch((err) => line(`  could not speak: ${err.message}`));
      return spoken;
    },

    interrupt() {
      session?.stopSpeaking();
    },

    stop() {
      session?.stop();
      session = null;
    }
  };
}
