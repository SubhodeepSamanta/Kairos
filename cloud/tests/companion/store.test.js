import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  addTurn, loadTurns, addEvent, loadEvents, addMood, loadMoods,
  getPrefs, setPrefs, forgetChat, resetCompanionCacheForTests,
  countTurns, loadTurnsBefore, setSummary, unifyIdentity, IDENTITY
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

  it("keeps counting past the 300-turn archive cap", async () => {
    for (let i = 0; i < 310; i++) await addTurn("a", "user", `msg ${i}`);
    expect(await countTurns("a")).toBe(310);
    const turns = await loadTurns("a");
    expect(turns[turns.length - 1].text).toBe("msg 309");
  });

  it("summarizes the right turns even after old ones were archived away", async () => {
    for (let i = 0; i < 310; i++) await addTurn("a", "user", `msg ${i}`);
    await setSummary("a", "old summary", 100);
    const older = await loadTurnsBefore("a", 310);
    expect(older[0].text).toBe("msg 100");
    expect(older[older.length - 1].text).toBe("msg 295");
  });

  it("still reads turns saved in the old array format", async () => {
    const fs = await import("fs");
    const path = await import("path");
    fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    fs.writeFileSync(
      path.join(process.cwd(), "data", "turns.json"),
      JSON.stringify({ legacy: [{ role: "user", text: "old style", at: new Date().toISOString() }] })
    );
    resetCompanionCacheForTests();
    const turns = await loadTurns("legacy");
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("old style");
    expect(await countTurns("legacy")).toBe(1);
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

describe("unifyIdentity", () => {
  it("merges every surface's history into the one shared identity", async () => {
    await addTurn("cli", "user", "from the terminal");
    await addTurn("1308424481", "user", "from telegram");
    await addTurn("1308424481", "assistant", "hey!");
    await addEvent("cli", "opened youtube", true, 2);
    await addMood("1308424481", "tired", 0.8, "late night");
    await setPrefs("1308424481", { persona: "sassy" });

    await unifyIdentity();

    expect((await loadTurns(IDENTITY)).map(t => t.text)).toEqual(["from the terminal", "from telegram", "hey!"]);
    expect(await loadEvents(IDENTITY)).toHaveLength(1);
    expect(await loadMoods(IDENTITY)).toHaveLength(1);
    expect((await getPrefs(IDENTITY)).persona).toBe("sassy");
    expect(await loadTurns("cli")).toHaveLength(0);
    expect(await loadTurns("1308424481")).toHaveLength(0);
  });

  it("keeps the prefs of the surface with the most history", async () => {
    await addTurn("cli", "user", "one message");
    for (let i = 0; i < 5; i++) await addTurn("tg", "user", `msg ${i}`);
    await setPrefs("cli", { persona: "nova" });
    await setPrefs("tg", { persona: "mentor" });

    await unifyIdentity();

    expect((await getPrefs(IDENTITY)).persona).toBe("mentor");
  });

  it("leaves an already-unified store untouched", async () => {
    await addTurn(IDENTITY, "user", "hello");
    await unifyIdentity();
    expect((await loadTurns(IDENTITY)).map(t => t.text)).toEqual(["hello"]);
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
