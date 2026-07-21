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

function harness({ transcripts = [], speaking = false } = {}) {
  const events = { transcripts: [], statuses: [], errors: [] };
  let feed = null;
  const queue = [...transcripts];

  const speaker = {
    isSpeaking: vi.fn(() => speaking),
    speak: vi.fn(async () => true),
    stop: vi.fn(() => { speaking = false; }),
    prepare: vi.fn(async () => true),
    engineName: () => "fake"
  };

  const session = createVoiceSession({
    onTranscript: (t) => events.transcripts.push(t),
    onStatus: (s) => events.statuses.push(s),
    onError: (e) => events.errors.push(e),
    speakerFactory: () => speaker,
    transcriberFactory: () => ({
      ready: async () => true,
      transcribe: async () => (queue.length ? { text: queue.shift(), durationMs: 900 } : null)
    }),
    microphoneFactory: async ({ onFrame }) => {
      feed = onFrame;
      return { device: "Fake Mic", stop: vi.fn() };
    }
  });

  return {
    session,
    speaker,
    events,
    push: (f, times = 1) => { for (let i = 0; i < times; i++) feed(f); },
    setSpeaking: (on) => { speaking = on; }
  };
}

const settle = () => new Promise((r) => setTimeout(r, 10));

describe("voice session", () => {
  it("starts the microphone and reports the device", async () => {
    const h = harness();
    expect(await h.session.start()).toBe(true);
    expect(h.session.isRunning()).toBe(true);
    expect(h.session.device()).toBe("Fake Mic");
  });

  it("sends a command that arrived with the wake word", async () => {
    const h = harness({ transcripts: ["Kairos, open my inbox"] });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 40);
    h.push(QUIET, 45);
    await settle();

    expect(h.events.transcripts).toHaveLength(1);
    expect(h.events.transcripts[0]).toMatchObject({ text: "open my inbox", viaWake: true });
  });

  it("stays quiet when speech was never addressed to her", async () => {
    const h = harness({ transcripts: ["can you pass me the salt"] });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 40);
    h.push(QUIET, 45);
    await settle();

    expect(h.events.transcripts).toHaveLength(0);
  });

  it("opens a listening window when only the wake word was said", async () => {
    const h = harness({ transcripts: ["Kairos", "what's the weather"] });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 40);
    h.push(QUIET, 45);
    await settle();
    expect(h.events.transcripts).toHaveLength(0);

    h.push(LOUD, 40);
    h.push(QUIET, 45);
    await settle();

    expect(h.events.transcripts).toHaveLength(1);
    expect(h.events.transcripts[0].text).toBe("what's the weather");
  });

  it("ignores its own voice during the grace window after it starts speaking", async () => {
    const h = harness({ transcripts: ["Kairos, hello"], speaking: true });
    await h.session.start();

    h.session.speak("a long sentence she is saying");
    h.push(LOUD, 60);
    await settle();

    expect(h.speaker.stop).not.toHaveBeenCalled();
    expect(h.events.transcripts).toHaveLength(0);
  });

  it("stops talking the moment the user interrupts", async () => {
    const h = harness({ speaking: true });
    await h.session.start();

    await new Promise((r) => setTimeout(r, 450));
    h.push(LOUD, 40);
    await settle();

    expect(h.speaker.stop).toHaveBeenCalled();
    expect(h.events.statuses).toContain("okay, go ahead");
  });

  it("drops nothing but also sends nothing when the transcript is noise", async () => {
    const h = harness({ transcripts: [] });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 40);
    h.push(QUIET, 45);
    await settle();

    expect(h.events.transcripts).toHaveLength(0);
    expect(h.events.errors).toHaveLength(0);
  });

  it("discards a click that is too short to be speech", async () => {
    const h = harness({ transcripts: ["Kairos, open my inbox"] });
    await h.session.start();

    h.push(QUIET, 30);
    h.push(LOUD, 8);
    h.push(QUIET, 45);
    await settle();

    expect(h.events.transcripts).toHaveLength(0);
  });

  it("passes the persona voice through to the speaker", async () => {
    const h = harness();
    await h.session.start();
    h.session.setPersona({ engine: "kokoro", voice: "am_michael", rate: 1.1, pitch: 1 });

    await h.session.speak("hello there");

    expect(h.speaker.speak).toHaveBeenCalledWith(
      "hello there",
      expect.objectContaining({ voice: "am_michael" })
    );
  });

  it("shuts the microphone down on stop", async () => {
    const h = harness();
    await h.session.start();
    h.session.stop();

    expect(h.session.isRunning()).toBe(false);
    expect(h.speaker.stop).toHaveBeenCalled();
  });

  it("reports a microphone that will not start instead of throwing", async () => {
    const events = [];
    const session = createVoiceSession({
      onError: (e) => events.push(e),
      speakerFactory: () => ({
        isSpeaking: () => false, speak: async () => true, stop: () => {},
        prepare: async () => true, engineName: () => "fake"
      }),
      transcriberFactory: () => ({ ready: async () => true, transcribe: async () => null }),
      microphoneFactory: async () => { throw new Error("no microphone found"); }
    });

    expect(await session.start()).toBe(false);
    expect(events[0].message).toMatch(/no microphone found/);
  });
});
