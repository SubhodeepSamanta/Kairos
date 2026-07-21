import { createVoiceSession } from "./session.js";
import { stripMarkup } from "./markup.js";
import { listInputDevices } from "./capture.js";

const VOICE_COMMAND = /^\/?(?:voice|stt|tts|talk|listen)$/i;
const VOICE_OFF = /^\/?(?:voice|stt|tts)\s+(?:off|stop)$/i;
const VOICE_DEVICES = /^\/?(?:voice|mic)\s+devices$/i;

export function isVoiceCommand(text) {
  const line = String(text || "").trim();
  return VOICE_COMMAND.test(line) || VOICE_OFF.test(line) || VOICE_DEVICES.test(line);
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
      if (!session?.isRunning()) return;
      const spoken = stripMarkup(text);
      if (spoken) session.speak(text).catch(() => {});
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
