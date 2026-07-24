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

  it("caps stored facts and drops the oldest, surviving a reload", () => {
    for (let i = 0; i < 305; i++) rememberFact(`fact_${i}`, `v${i}`);
    const kept = getAllFacts();
    expect(Object.keys(kept).length).toBe(300);
    expect(kept.fact_0).toBeUndefined();
    expect(kept.fact_304).toBe("v304");
    resetMemoryCacheForTests();
    expect(Object.keys(getAllFacts()).length).toBe(300);
  });

  it("formats facts for prompt", () => {
    expect(formatFactsForPrompt({})).toBe("none yet");
    expect(formatFactsForPrompt({ a: "1", b: "2" })).toBe("a: 1\nb: 2");
  });

  it("ranks word-boundary matches above buried substrings", () => {
    for (let i = 0; i < 45; i++) rememberFact(`filler_${i}`, `value ${i}`);
    rememberFact("git_config", "aliases set");
    rememberFact("github_username", "torvalds");
    rememberFact("site:github", "https://github.com");

    const relevant = relevantFacts("open github");
    expect(relevant.github_username).toBe("torvalds");
    expect(relevant["site:github"]).toBe("https://github.com");
  });

  it("prefers matching facts over unrelated recent ones", () => {
    rememberFact("site:twitch", "https://twitch.tv");
    for (let i = 0; i < 45; i++) rememberFact(`noise_${i}`, `nothing ${i}`);
    const relevant = relevantFacts("play something on twitch");
    expect(relevant["site:twitch"]).toBe("https://twitch.tv");
    expect(Object.keys(relevant)[0]).toBe("site:twitch");
  });
});
