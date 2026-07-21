import { describe, it, expect, vi } from "vitest";
import { createVoiceController, isVoiceCommand } from "../../src/voice/cli.js";

function controller() {
  const written = [];
  const sent = [];
  let running = false;
  let handlers = {};

  const session = {
    isRunning: () => running,
    start: vi.fn(async () => { running = true; return true; }),
    stop: vi.fn(() => { running = false; }),
    speak: vi.fn(async () => true),
    stopSpeaking: vi.fn(),
    setPersona: vi.fn()
  };

  const ctrl = createVoiceController({
    write: (t) => written.push(t),
    sendGoal: (t) => sent.push(t),
    sessionFactory: (opts) => { handlers = opts; return session; }
  });

  return { ctrl, session, written, sent, fire: () => handlers };
}

describe("voice commands", () => {
  it("recognises the ways someone asks for voice", () => {
    for (const cmd of ["voice", "/voice", "tts", "stt", "TTS", "/talk", "listen", "voice off", "/voice stop", "voice devices"]) {
      expect(isVoiceCommand(cmd), cmd).toBe(true);
    }
  });

  it("leaves ordinary sentences alone", () => {
    for (const line of ["what's my voice like", "turn on the tv", "hello", "voice of reason"]) {
      expect(isVoiceCommand(line), line).toBe(false);
    }
  });
});

describe("voice controller", () => {
  it("starts on the voice command and toggles off on a second one", async () => {
    const { ctrl, session } = controller();

    expect(await ctrl.handle("voice")).toBe(true);
    expect(session.start).toHaveBeenCalled();
    expect(ctrl.isActive()).toBe(true);

    await ctrl.handle("voice");
    expect(session.stop).toHaveBeenCalled();
    expect(ctrl.isActive()).toBe(false);
  });

  it("stops on an explicit off command", async () => {
    const { ctrl, session } = controller();
    await ctrl.handle("voice");
    await ctrl.handle("voice off");
    expect(session.stop).toHaveBeenCalled();
  });

  it("says so when voice is already off", async () => {
    const { ctrl, written } = controller();
    await ctrl.handle("voice off");
    expect(written.join(" ")).toMatch(/already off/);
  });

  it("passes anything that is not a voice command back to the caller", async () => {
    const { ctrl } = controller();
    expect(await ctrl.handle("book me a flight")).toBe(false);
  });

  it("sends what it heard as a goal, carrying the tone", async () => {
    const { ctrl, fire, sent } = controller();
    await ctrl.handle("voice");

    fire().onTranscript({ text: "open my inbox", tone: "quieter than usual" });

    expect(sent[0]).toContain("open my inbox");
    expect(sent[0]).toContain("quieter than usual");
  });

  it("sends plain text when there is no tone to report", async () => {
    const { ctrl, fire, sent } = controller();
    await ctrl.handle("voice");

    fire().onTranscript({ text: "open my inbox", tone: null });

    expect(sent[0]).toBe("open my inbox");
  });

  it("strips delivery markup before showing a reply", async () => {
    const { ctrl, session } = controller();
    await ctrl.handle("voice");

    const shown = ctrl.speak("Hey. [pause:300] [smile] Good to see you.");

    expect(shown).not.toContain("[pause:300]");
    expect(shown).not.toContain("[smile]");
    expect(session.speak).toHaveBeenCalledWith("Hey. [pause:300] [smile] Good to see you.");
  });

  it("stays silent when voice is off", async () => {
    const { ctrl, session } = controller();
    ctrl.speak("hello");
    expect(session.speak).not.toHaveBeenCalled();
  });

  it("hands the persona voice to the session", async () => {
    const { ctrl, session } = controller();
    await ctrl.handle("voice");
    ctrl.setPersona({ voice: "am_michael" });
    expect(session.setPersona).toHaveBeenCalledWith({ voice: "am_michael" });
  });
});
