import { describe, it, expect } from "vitest";
import { genderOf, DEFAULT_VOICE } from "../../src/voice/tts/index.js";
import { buildSsml } from "../../src/voice/tts/sapi.js";
import { encodeWav, toInt16, silenceWav } from "../../src/voice/tts/wav.js";
import { createPlayer } from "../../src/voice/tts/playback.js";

describe("voice ids", () => {
  it("reads gender from the kokoro voice prefix", () => {
    expect(genderOf("am_michael")).toBe("male");
    expect(genderOf("bm_george")).toBe("male");
    expect(genderOf("af_heart")).toBe("female");
    expect(genderOf("bf_emma")).toBe("female");
  });

  it("falls back to female when the voice is unknown", () => {
    expect(genderOf(null)).toBe("female");
    expect(genderOf("")).toBe("female");
  });

  it("uses a real kokoro id as the default", () => {
    expect(DEFAULT_VOICE.voice).toMatch(/^[ab][fm]_/);
  });
});

describe("wav encoding", () => {
  it("writes a 44 byte header and 16 bit mono samples", () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5]), 24000);
    expect(wav.length).toBe(44 + 6);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt16LE(22)).toBe(1);
  });

  it("clamps instead of wrapping when volume pushes past full scale", () => {
    const out = toInt16(new Float32Array([1, -1]), 4);
    expect(out[0]).toBe(32767);
    expect(out[1]).toBe(-32768);
  });

  it("sizes silence from the duration", () => {
    expect(silenceWav(100, 24000).length).toBe(44 + 2400 * 2);
  });
});

describe("sapi ssml", () => {
  it("escapes text that would otherwise break the xml", () => {
    const ssml = buildSsml({ text: `5 < 6 & "quoted"`, rate: 1, pitch: 1, volume: 1 }, "Zira");
    expect(ssml).toContain("&lt;");
    expect(ssml).toContain("&amp;");
    expect(ssml).not.toContain(`"quoted"`);
  });

  it("maps multipliers to clamped percentages", () => {
    const ssml = buildSsml({ text: "hi", rate: 1.2, pitch: 0.9, volume: 1 }, null);
    expect(ssml).toContain(`rate="+20%"`);
    expect(ssml).toContain(`pitch="-10%"`);
  });

  it("omits the voice element when no voice is chosen", () => {
    expect(buildSsml({ text: "hi", rate: 1, pitch: 1, volume: 1 }, null)).not.toContain("<voice");
  });
});

function fakeSpawn(onSpawn) {
  return () => {
    const handlers = {};
    const proc = {
      on: (event, fn) => { handlers[event] = fn; return proc; },
      kill: () => { proc.killed = true; handlers.close?.(1); },
      killed: false
    };
    onSpawn?.(() => handlers.close?.(0));
    return proc;
  };
}

describe("playback", () => {
  it("cancels a pause immediately instead of waiting it out", async () => {
    const player = createPlayer({ spawnFn: fakeSpawn() });
    const started = Date.now();
    const waiting = player.pause(5000);
    player.stop();
    await waiting;
    expect(Date.now() - started).toBeLessThan(1000);
    expect(player.isCancelled()).toBe(true);
  });

  it("refuses to play once cancelled, and resumes cleanly", async () => {
    const player = createPlayer({ spawnFn: fakeSpawn((done) => done()) });
    player.stop();
    expect(await player.play(silenceWav(10))).toBe(false);
    player.resume();
    expect(player.isCancelled()).toBe(false);
  });

  it("reports completion from the player exit code", async () => {
    const player = createPlayer({ spawnFn: fakeSpawn((done) => setTimeout(done, 5)) });
    expect(await player.play(silenceWav(10))).toBe(true);
    expect(player.isPlaying()).toBe(false);
  });
});

describe("overlapping replies", () => {
  function stubEngine(order) {
    return {
      name: "kokoro",
      ready: async () => true,
      supportsVoice: () => true,
      synthesize: async (segment) => {
        order.push(`synth:${segment.text.slice(0, 12)}`);
        await new Promise(r => setTimeout(r, 20));
        return silenceWav(5);
      }
    };
  }

  it("a newer reply cancels the older one instead of talking over it", async () => {
    const order = [];
    const { createSpeaker } = await import("../../src/voice/tts/index.js");
    const speaker = createSpeaker({ engineFactory: () => stubEngine(order) });

    const first = speaker.speak("aaaa. bbbb. cccc. dddd.", { voice: "af_heart", rate: 1, pitch: 1 });
    await new Promise(r => setTimeout(r, 5));
    const second = await speaker.speak("zzzz.", { voice: "af_heart", rate: 1, pitch: 1 });

    expect(await first).toBe(false);
    expect(second).toBe(true);
  });

  it("finishes a reply when nothing interrupts it", async () => {
    const order = [];
    const { createSpeaker } = await import("../../src/voice/tts/index.js");
    const speaker = createSpeaker({ engineFactory: () => stubEngine(order) });
    expect(await speaker.speak("just one line.", { voice: "af_heart", rate: 1, pitch: 1 })).toBe(true);
  });
});

describe("silent playback failures", () => {
  it("says so instead of pretending it spoke when no chunk ever played", async () => {
    const errors = [];
    const { createSpeaker } = await import("../../src/voice/tts/index.js");
    const speaker = createSpeaker({
      onError: (e) => errors.push(e.message),
      engineFactory: () => ({
        name: "kokoro",
        ready: async () => true,
        supportsVoice: () => true,
        synthesize: async () => silenceWav(5)
      }),
      playerFactory: () => ({
        isPlaying: () => false,
        isCancelled: () => false,
        lastError: () => "player exited 1",
        play: async () => false,
        pause: async () => {},
        stop: () => {},
        resume: () => {}
      })
    });

    expect(await speaker.speak("hello there.", { voice: "af_heart", rate: 1, pitch: 1 })).toBe(false);
    expect(errors.join(" ")).toMatch(/no audio came out/);
    expect(errors.join(" ")).toContain("player exited 1");
  });

  it("keeps the stderr tail from a failed player", async () => {
    const handlers = {};
    const proc = {
      stderr: { on: (ev, fn) => { if (ev === "data") handlers.data = fn; } },
      on: (event, fn) => { handlers[event] = fn; return proc; },
      kill: () => {}
    };
    const player = createPlayer({ spawnFn: () => { setTimeout(() => { handlers.data?.(Buffer.from("Exception calling PlaySync")); handlers.close?.(1); }, 5); return proc; } });
    expect(await player.play(silenceWav(10))).toBe(false);
    expect(player.lastError()).toContain("PlaySync");
  });
});
