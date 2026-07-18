import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const llmCalls = [];
let llmFails = false;

vi.mock("../../src/llm/provider.js", () => ({
  askLLM: vi.fn(async (system, user) => {
    if (llmFails) throw new Error("providers down");
    llmCalls.push(user);
    return "ground through leetcode graphs (2 of 3 solved), then lofi";
  })
}));

const { buildRecentDays, dayKey } = await import("../../src/companion/digest.js");
const { resetCompanionCacheForTests } = await import("../../src/companion/store.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-digest-"));
const originalCwd = process.cwd();

function writeEvents(chatId, events) {
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "data", "events.json"), JSON.stringify({ [chatId]: events }));
  resetCompanionCacheForTests();
}

const yesterday = new Date(Date.now() - 86400000).toISOString();
const today = new Date().toISOString();

beforeEach(() => {
  process.chdir(tmp);
  fs.rmSync(path.join(tmp, "data"), { recursive: true, force: true });
  resetCompanionCacheForTests();
  llmCalls.length = 0;
  llmFails = false;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("daily digests", () => {
  it("compresses a busy past day once and caches it", async () => {
    writeEvents("a", [
      { summary: "opened leetcode 112", success: true, at: yesterday },
      { summary: "opened leetcode 207", success: false, at: yesterday },
      { summary: "played lofi", success: true, at: yesterday },
      { summary: "checked github", success: true, at: today }
    ]);

    const first = await buildRecentDays("a");
    expect(first).toContain("today: checked github");
    expect(first).toContain("yesterday: ground through leetcode graphs");
    expect(llmCalls.length).toBe(1);

    const second = await buildRecentDays("a");
    expect(second).toContain("yesterday: ground through leetcode graphs");
    expect(llmCalls.length).toBe(1);
  });

  it("keeps today raw without spending an LLM call", async () => {
    writeEvents("a", [
      { summary: "one", success: true, at: today },
      { summary: "two", success: true, at: today },
      { summary: "three", success: true, at: today },
      { summary: "four", success: true, at: today }
    ]);
    const out = await buildRecentDays("a");
    expect(out).toContain("today: one; two; three; four [4/4 worked]");
    expect(llmCalls.length).toBe(0);
  });

  it("falls back to the raw line when the LLM is down", async () => {
    llmFails = true;
    writeEvents("a", [
      { summary: "opened leetcode 112", success: true, at: yesterday },
      { summary: "opened leetcode 207", success: false, at: yesterday },
      { summary: "played lofi", success: true, at: yesterday }
    ]);
    const out = await buildRecentDays("a");
    expect(out).toContain("yesterday: opened leetcode 112; opened leetcode 207; played lofi [2/3 worked]");
  });

  it("skips the LLM for quiet days", async () => {
    writeEvents("a", [{ summary: "just music", success: true, at: yesterday }]);
    const out = await buildRecentDays("a");
    expect(out).toContain("yesterday: just music [1/1 worked]");
    expect(llmCalls.length).toBe(0);
  });

  it("says so when nothing happened", async () => {
    writeEvents("a", []);
    expect(await buildRecentDays("a")).toContain("nothing recorded");
  });

  it("labels days with a stable local key", () => {
    expect(dayKey("2026-07-19T10:00:00")).toBe("2026-07-19");
  });
});
