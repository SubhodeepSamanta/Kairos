import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  rememberFact,
  forgetFact,
  getAllFacts,
  relevantFacts,
  formatFactsForPrompt,
  resetMemoryCacheForTests
} from "../../src/memory/store.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-mem-"));
const originalCwd = process.cwd();

beforeEach(() => {
  process.chdir(tmpDir);
  fs.rmSync(path.join(tmpDir, "data"), { recursive: true, force: true });
  resetMemoryCacheForTests();
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("memory store", () => {
  it("remembers and normalizes keys", () => {
    rememberFact("GitHub Username", "torvalds");
    expect(getAllFacts()).toEqual({ github_username: "torvalds" });
  });

  it("persists to disk and reloads", () => {
    rememberFact("site:twitch", "https://twitch.tv");
    resetMemoryCacheForTests();
    expect(getAllFacts()["site:twitch"]).toBe("https://twitch.tv");
  });

  it("forgets facts", () => {
    rememberFact("a", "1");
    expect(forgetFact("a")).toBe(true);
    expect(getAllFacts()).toEqual({});
    expect(forgetFact("missing")).toBe(false);
  });

  it("rejects empty keys and values", () => {
    expect(rememberFact("", "x")).toBe(false);
    expect(rememberFact("k", null)).toBe(false);
  });

  it("returns all facts when few, filters by relevance when many", () => {
    for (let i = 0; i < 50; i++) rememberFact(`filler_${i}`, `value ${i}`);
    rememberFact("github_username", "torvalds");
    const relevant = relevantFacts("show my github contributions");
    expect(Object.keys(relevant).length).toBeLessThanOrEqual(40);
    expect(relevant.github_username).toBe("torvalds");
  });

  it("formats facts for prompt", () => {
    expect(formatFactsForPrompt({})).toBe("none yet");
    expect(formatFactsForPrompt({ a: "1", b: "2" })).toBe("a: 1\nb: 2");
  });
});
