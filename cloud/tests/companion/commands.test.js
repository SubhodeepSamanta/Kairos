import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { runCommand, isCommand, COMMANDS } from "../../src/companion/commands.js";
import { addEvent, setPrefs, resetCompanionCacheForTests } from "../../src/companion/store.js";
import { rememberFact, resetMemoryCacheForTests } from "../../src/memory/store.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-cmd-"));
const originalCwd = process.cwd();

beforeEach(() => {
  process.chdir(tmp);
  fs.rmSync(path.join(tmp, "data"), { recursive: true, force: true });
  resetCompanionCacheForTests();
  resetMemoryCacheForTests();
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("/about", () => {
  it("is a registered command", () => {
    expect(isCommand("/about")).toBe(true);
    expect(COMMANDS.some(c => c.name === "/about")).toBe(true);
  });

  it("introduces the current persona and fact count", async () => {
    await setPrefs("u1", { persona: "nova" });
    rememberFact("github_username", "torvalds");
    const reply = await runCommand("u1", "/about");
    expect(reply).toMatch(/Nova/);
    expect(reply).toMatch(/1 fact/);
  });

  it("reflects weekly activity when events exist", async () => {
    await addEvent("u2", "opened youtube", true, 3);
    await addEvent("u2", "failed login", false, 5);
    const reply = await runCommand("u2", "/about");
    expect(reply).toMatch(/2 things this week/);
    expect(reply).toMatch(/1 worked out/);
  });

  it("falls back gracefully with no data", async () => {
    const reply = await runCommand("fresh", "/about");
    expect(reply).toMatch(/talking to/i);
    expect(reply).toMatch(/getting to know you/i);
  });
});
