import { describe, it, expect, vi } from "vitest";
import { createVoiceSession } from "../../src/voice/session.js";
import { FRAME_SAMPLES } from "../../src/voice/config.js";

function frame(amplitude) {
  const f = new Int16Array(FRAME_SAMPLES);
  for (let i = 0; i < FRAME_SAMPLES; i++) {
    f[i] = Math.round(amplitude * Math.sin((2 * Math.PI * 140 * i) / 16000));
  }
  return f;
}

const LOUD = frame(6000);
const QUIET = frame(20);

function harness({ transcribeDelayMs = 0 } = {}) {
  const events = { transcripts: [], statuses: [] };
  let feed = null;

  const session = createVoiceSession({
    onTranscript: (t) => events.transcripts.push(t),
    onStatus: (s) => events.statuses.push(s),
    onError: () => {},
    speakerFactory: () => ({
      isSpeaking: () => false,
      speak: async () => true,
      stop: vi.fn(),
      prepare: async () => true,
      engineName: () => "fake"
    }),
    transcriberFactory: () => ({
      ready: async () => true,
      transcribe: async () => {
        if (transcribeDelayMs) await new Promise((r) => setTimeout(r, transcribeDelayMs));
        return { text: "open my inbox", durationMs: 900 };
      }
    }),
    microphoneFactory: async ({ onFrame }) => {
      feed = onFrame;
      return { device: "Fake Mic", stop: vi.fn() };
    },
    calibrationMs: 0,
    requireWake: false
  });

  return { session, events, push: (f, times = 1) => { for (let i = 0; i < times; i++) feed(f); } };
}

describe("turning voice off mid-thought", () => {
  it("does not send a goal for speech she was still transcribing when you stopped her", async () => {
    const h = harness({ transcribeDelayMs: 60 });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 40);
    h.push(QUIET, 45);

    h.session.stop();
    await new Promise((r) => setTimeout(r, 150));

    expect(h.events.transcripts).toHaveLength(0);
  });

  it("drops speech that was queued behind the utterance in flight", async () => {
    const h = harness({ transcribeDelayMs: 60 });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 40);
    h.push(QUIET, 45);
    h.push(LOUD, 40);
    h.push(QUIET, 45);

    h.session.stop();
    await new Promise((r) => setTimeout(r, 200));

    expect(h.events.transcripts).toHaveLength(0);
  });

  it("still sends the goal normally when she was not stopped", async () => {
    const h = harness({ transcribeDelayMs: 60 });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 40);
    h.push(QUIET, 45);
    await new Promise((r) => setTimeout(r, 150));

    expect(h.events.transcripts.map(t => t.text)).toEqual(["open my inbox"]);
  });
});
