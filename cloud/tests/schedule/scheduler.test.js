import { describe, it, expect, beforeEach } from "vitest";
import {
  scheduleGoal, listSchedule, cancelScheduled, dueEntries, tick,
  clearScheduleForTests, formatSchedule
} from "../../src/schedule/scheduler.js";

const NOW = 1_800_000_000_000;

beforeEach(() => clearScheduleForTests());

describe("scheduling", () => {
  it("keeps what you asked for, sorted by when", () => {
    scheduleGoal({ goal: "later", at: NOW + 5000 });
    scheduleGoal({ goal: "sooner", at: NOW + 1000 });
    expect(listSchedule().map(e => e.goal)).toEqual(["sooner", "later"]);
  });

  it("gives each one a short id you can cancel by", () => {
    const e = scheduleGoal({ goal: "thing", at: NOW + 1000 });
    expect(e.id).toMatch(/^[a-z0-9]+$/);
    expect(cancelScheduled(e.id).goal).toBe("thing");
    expect(listSchedule()).toHaveLength(0);
  });

  it("returns null cancelling something that is not there", () => {
    expect(cancelScheduled("nope")).toBeNull();
  });

  it("refuses to pile up without bound", () => {
    for (let i = 0; i < 40; i++) scheduleGoal({ goal: `g${i}`, at: NOW + i });
    expect(() => scheduleGoal({ goal: "one too many", at: NOW })).toThrow(/already have/);
  });
});

describe("firing when due", () => {
  it("only counts entries whose time has come", () => {
    scheduleGoal({ goal: "past", at: NOW - 1000 });
    scheduleGoal({ goal: "future", at: NOW + 100000 });
    expect(dueEntries(NOW).map(e => e.goal)).toEqual(["past"]);
  });

  it("runs a one-off once and then forgets it", async () => {
    const fired = [];
    scheduleGoal({ goal: "wake up", at: NOW - 1000 });
    const { startScheduler, stopScheduler } = await import("../../src/schedule/scheduler.js");
    startScheduler((e) => { fired.push(e.goal); }, { intervalMs: 999999 });
    await tick(NOW);
    stopScheduler();

    expect(fired).toEqual(["wake up"]);
    expect(listSchedule()).toHaveLength(0);
  });

  it("keeps a daily reminder, rolling it to the next day", async () => {
    const fired = [];
    const day = 86400000;
    scheduleGoal({ goal: "morning brief", at: NOW - 1000, repeatMs: day });
    const { startScheduler, stopScheduler } = await import("../../src/schedule/scheduler.js");
    startScheduler((e) => { fired.push(e.goal); }, { intervalMs: 999999 });
    await tick(NOW);
    stopScheduler();

    expect(fired).toEqual(["morning brief"]);
    const remaining = listSchedule();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].at).toBeGreaterThan(NOW);
  });

  it("does not fire a one-off that is more than six hours late", async () => {
    const fired = [];
    scheduleGoal({ goal: "stale", at: NOW - 7 * 3600000 });
    const { startScheduler, stopScheduler } = await import("../../src/schedule/scheduler.js");
    startScheduler((e) => { fired.push(e.goal); }, { intervalMs: 999999 });
    await tick(NOW);
    stopScheduler();

    expect(fired).toEqual([]);
    expect(listSchedule()).toHaveLength(0);
  });

  it("survives a runner that throws", async () => {
    scheduleGoal({ goal: "boom", at: NOW - 1000 });
    const { startScheduler, stopScheduler } = await import("../../src/schedule/scheduler.js");
    startScheduler(() => { throw new Error("kaboom"); }, { intervalMs: 999999 });
    await expect(tick(NOW)).resolves.toBe(1);
    stopScheduler();
  });
});

describe("showing the list", () => {
  it("says plainly when there is nothing", () => {
    expect(formatSchedule(NOW)).toMatch(/nothing scheduled/);
  });

  it("lists each with its id and time", () => {
    scheduleGoal({ goal: "call mum", at: NOW + 3600000 });
    const out = formatSchedule(NOW);
    expect(out).toContain("call mum");
    expect(out).toMatch(/unschedule/);
  });
});
