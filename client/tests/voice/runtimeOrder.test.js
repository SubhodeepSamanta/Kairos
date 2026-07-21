import { describe, it, expect, beforeEach } from "vitest";
import {
  sttWanted, sttSettled, sttStatus, waitForSttIfWanted, resetRuntimeOrderForTests
} from "../../src/voice/runtimeOrder.js";

beforeEach(() => resetRuntimeOrderForTests());

describe("keeping the two onnx runtimes from colliding", () => {
  it("lets the voice load immediately when the ears were never asked for", async () => {
    const started = Date.now();
    await expect(waitForSttIfWanted(500)).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("holds the voice back until the ears have finished loading", async () => {
    sttWanted();
    let released = false;
    const waiting = waitForSttIfWanted(2000).then((ok) => { released = ok; });

    await new Promise((r) => setTimeout(r, 60));
    expect(released).toBe(false);

    sttSettled();
    await waiting;
    expect(released).toBe(true);
  });

  it("does not hold anything back once the ears are already loaded", async () => {
    sttWanted();
    sttSettled();
    const started = Date.now();
    await expect(waitForSttIfWanted(2000)).resolves.toBe(true);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it("gives up rather than hanging forever if the ears never arrive", async () => {
    sttWanted();
    await expect(waitForSttIfWanted(120)).resolves.toBe(false);
  });

  it("releases every waiter at once", async () => {
    sttWanted();
    const all = Promise.all([waitForSttIfWanted(2000), waitForSttIfWanted(2000), waitForSttIfWanted(2000)]);
    sttSettled();
    expect(await all).toEqual([true, true, true]);
  });

  it("reports what it is waiting on", () => {
    expect(sttStatus()).toEqual({ wanted: false, settled: false });
    sttWanted();
    expect(sttStatus()).toEqual({ wanted: true, settled: false });
    sttSettled();
    expect(sttStatus()).toEqual({ wanted: true, settled: true });
  });
});

describe("the wiring", () => {
  it("marks the ears as wanted the moment a transcriber is created", async () => {
    const { createTranscriber } = await import("../../src/voice/stt.js");
    expect(sttStatus().wanted).toBe(false);
    createTranscriber();
    expect(sttStatus().wanted).toBe(true);
  });
});
