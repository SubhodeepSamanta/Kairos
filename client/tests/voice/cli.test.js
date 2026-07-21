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
    sendGoal: (t, tone) => sent.push({ text: t, tone }),
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

    expect(sent[0].text).toBe("open my inbox");
    expect(sent[0].tone).toBe("quieter than usual");
  });

  it("sends plain text when there is no tone to report", async () => {
    const { ctrl, fire, sent } = controller();
    await ctrl.handle("voice");

    fire().onTranscript({ text: "open my inbox", tone: null });

    expect(sent[0].text).toBe("open my inbox");
    expect(sent[0].tone).toBeNull();
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

describe("persona voices", () => {
  it("remembers a persona that arrives before voice has started", async () => {
    const { ctrl, session } = controller();

    ctrl.setPersona({ engine: "kokoro", voice: "am_michael", rate: 0.98, pitch: 0.95 });
    await ctrl.handle("voice");

    expect(session.setPersona).toHaveBeenCalledWith(
      expect.objectContaining({ voice: "am_michael" })
    );
  });

  it("tells the cloud when voice turns on and off", async () => {
    const modes = [];
    const session = {
      isRunning: () => running,
      start: async () => { running = true; return true; },
      stop: () => { running = false; },
      speak: async () => true, stopSpeaking: () => {}, setPersona: () => {}
    };
    let running = false;
    const { createVoiceController } = await import("../../src/voice/cli.js");
    const ctrl = createVoiceController({
      write: () => {}, sendGoal: () => {},
      onModeChange: (on) => modes.push(on),
      sessionFactory: () => session
    });

    await ctrl.handle("voice");
    await ctrl.handle("voice");

    expect(modes).toEqual([true, false]);
  });
});

describe("saying stop out loud", () => {
  function stopHarness(busy) {
    const sent = [], written = [], cancels = [];
    let handlers = {};
    const session = {
      isRunning: () => true, start: async () => true, stop: () => {},
      speak: async () => true, stopSpeaking: vi.fn(), setPersona: () => {}
    };
    const ctrl = createVoiceController({
      write: t => written.push(t),
      sendGoal: (t) => sent.push(t),
      onCancel: () => cancels.push(true),
      isBusy: () => busy,
      sessionFactory: (opts) => { handlers = opts; return session; }
    });
    return { ctrl, sent, written, cancels, session, fire: () => handlers };
  }

  it("cancels the running goal instead of sending stop as a new one", async () => {
    const h = stopHarness(true);
    await h.ctrl.handle("voice");

    h.fire().onTranscript({ text: "stop", tone: null });

    expect(h.cancels).toHaveLength(1);
    expect(h.sent).toHaveLength(0);
  });

  it("shuts her up even when nothing is running", async () => {
    const h = stopHarness(false);
    await h.ctrl.handle("voice");

    h.fire().onTranscript({ text: "never mind", tone: null });

    expect(h.session.stopSpeaking).toHaveBeenCalled();
    expect(h.cancels).toHaveLength(0);
    expect(h.sent).toHaveLength(0);
  });

  it("still sends a real request that happens to contain the word stop", async () => {
    const h = stopHarness(true);
    await h.ctrl.handle("voice");

    h.fire().onTranscript({ text: "stop the music on spotify", tone: null });

    expect(h.cancels).toHaveLength(0);
    expect(h.sent[0]).toBe("stop the music on spotify");
  });
});

describe("saying it again", () => {
  function repeatHarness() {
    const written = [];
    let handlers = {};
    let running = true;
    const session = {
      isRunning: () => running,
      start: async () => { running = true; return true; },
      stop: () => { running = false; },
      speak: vi.fn(async () => true),
      stopSpeaking: vi.fn(),
      setPersona: () => {}
    };
    const ctrl = createVoiceController({
      write: t => written.push(t),
      sendGoal: () => {},
      sessionFactory: (opts) => { handlers = opts; return session; }
    });
    return { ctrl, session, written, fire: () => handlers };
  }

  it("repeats the last reply when asked out loud", async () => {
    const h = repeatHarness();
    await h.ctrl.handle("voice");
    h.ctrl.speak("the meeting is at four");
    h.session.speak.mockClear();

    h.fire().onTranscript({ text: "say that again", tone: null });

    expect(h.session.speak).toHaveBeenCalledWith("the meeting is at four");
  });

  it("says so when there is nothing to repeat", async () => {
    const h = repeatHarness();
    await h.ctrl.handle("voice");
    await h.ctrl.handle("again");
    expect(h.written.join(" ")).toMatch(/nothing to repeat/);
  });

  it("repeats on the typed command too", async () => {
    const h = repeatHarness();
    await h.ctrl.handle("voice");
    h.ctrl.speak("lofi is playing");
    h.session.speak.mockClear();

    await h.ctrl.handle("again");
    expect(h.session.speak).toHaveBeenCalledWith("lofi is playing");
  });
});

describe("mic test safety", () => {
  it("refuses to open a second microphone while she is listening", async () => {
    const written = [];
    const ctrl = createVoiceController({
      write: t => written.push(t),
      sendGoal: () => {},
      sessionFactory: () => ({
        isRunning: () => true, start: async () => true, stop: () => {},
        speak: async () => true, stopSpeaking: () => {}, setPersona: () => {}
      })
    });
    await ctrl.handle("voice");
    await ctrl.handle("voice test");
    expect(written.join(" ")).toMatch(/already listening/);
  });
});
