import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  addTurn, loadTurns, addEvent, loadEvents, addMood, loadMoods,
  getPrefs, setPrefs, forgetChat, resetCompanionCacheForTests
} from "../../src/companion/store.js";
import { formatConversation, formatEvents, formatMood } from "../../src/companion/context.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-comp-"));
const originalCwd = process.cwd();

beforeEach(() => {
  process.chdir(tmp);
  fs.rmSync(path.join(tmp, "data"), { recursive: true, force: true });
  resetCompanionCacheForTests();
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("conversation memory", () => {
  it("keeps turns in order per chat", async () => {
    await addTurn("a", "user", "hey");
    await addTurn("a", "assistant", "hey yourself");
    await addTurn("b", "user", "different chat");

    const turns = await loadTurns("a");
    expect(turns.map(t => t.text)).toEqual(["hey", "hey yourself"]);
    expect(await loadTurns("b")).toHaveLength(1);
  });

  it("rolls off old turns", async () => {
    for (let i = 0; i < 25; i++) await addTurn("a", "user", `msg ${i}`);
    const turns = await loadTurns("a");
    expect(turns.length).toBeLessThanOrEqual(14);
    expect(turns[turns.length - 1].text).toBe("msg 24");
  });

  it("ignores empty turns", async () => {
    await addTurn("a", "user", "");
    expect(await loadTurns("a")).toHaveLength(0);
  });
});

describe("episodic memory", () => {
  it("records what happened and formats it by day", async () => {
    await addEvent("a", "opened leetcode 112", true, 3);
    await addEvent("a", "played lofi", true, 2);
    const events = await loadEvents("a");
    expect(events).toHaveLength(2);

    const text = formatEvents(events);
    expect(text).toContain("today");
    expect(text).toContain("leetcode 112");
    expect(text).toContain("[2/2 worked]");
  });

  it("labels yesterday correctly", () => {
    const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();
    const text = formatEvents([{ summary: "github research", success: true, at: yesterday }]);
    expect(text).toContain("yesterday: github research");
  });

  it("says so when nothing happened", () => {
    expect(formatEvents([])).toContain("nothing recorded");
  });
});

describe("mood", () => {
  it("stores and summarizes with a trend", async () => {
    await addMood("a", "tired", 0.8, "said barely slept");
    await addMood("a", "tired", 0.7, "up at 2am");
    await addMood("a", "happy", 0.6, "solved it");

    const moods = await loadMoods("a");
    expect(moods).toHaveLength(3);

    const text = formatMood(moods);
    expect(text).toContain("latest: happy");
    expect(text).toContain("tired x2");
  });

  it("says so when there is no read", () => {
    expect(formatMood([])).toContain("no read yet");
  });
});

describe("prefs", () => {
  it("defaults to aria with mood tracking on", async () => {
    const prefs = await getPrefs("new-chat");
    expect(prefs.persona).toBe("aria");
    expect(prefs.moodTracking).toBe(true);
  });

  it("persists a persona switch per chat", async () => {
    await setPrefs("a", { persona: "mentor" });
    expect((await getPrefs("a")).persona).toBe("mentor");
    expect((await getPrefs("b")).persona).toBe("aria");
  });

  it("can turn mood tracking off", async () => {
    await setPrefs("a", { moodTracking: false });
    expect((await getPrefs("a")).moodTracking).toBe(false);
  });
});

describe("forgetting", () => {
  it("wipes only what was asked", async () => {
    await addTurn("a", "user", "hey");
    await addMood("a", "tired", 0.8, "why");
    await forgetChat("a", "moods");

    expect(await loadTurns("a")).toHaveLength(1);
    expect(await loadMoods("a")).toHaveLength(0);
  });

  it("wipes everything on all", async () => {
    await addTurn("a", "user", "hey");
    await addEvent("a", "did a thing", true, 1);
    await addMood("a", "tired", 0.8, "why");
    await forgetChat("a", "all");

    expect(await loadTurns("a")).toHaveLength(0);
    expect(await loadEvents("a")).toHaveLength(0);
    expect(await loadMoods("a")).toHaveLength(0);
  });
});

describe("formatConversation", () => {
  it("renders them/you", () => {
    const text = formatConversation([
      { role: "user", text: "hey" },
      { role: "assistant", text: "hi" }
    ]);
    expect(text).toBe("them: hey\nyou: hi");
  });

  it("handles the first ever exchange", () => {
    expect(formatConversation([])).toContain("first exchange");
  });
});
