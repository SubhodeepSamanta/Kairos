import { describe, it, expect } from "vitest";
import { parseWhen, describeWhen } from "../../src/schedule/when.js";

const NOON = new Date("2026-07-22T12:00:00").getTime();

describe("relative times", () => {
  it("reads minutes, hours, seconds and days", () => {
    expect(parseWhen("20m take a break", NOON).at).toBe(NOON + 20 * 60000);
    expect(parseWhen("in 2 hours check the oven", NOON).at).toBe(NOON + 2 * 3600000);
    expect(parseWhen("30s ping me", NOON).at).toBe(NOON + 30000);
    expect(parseWhen("3 days water the plants", NOON).at).toBe(NOON + 3 * 86400000);
  });

  it("keeps the task text and drops the time words", () => {
    expect(parseWhen("20m take a break", NOON).goal).toBe("take a break");
    expect(parseWhen("in 5 minutes, stretch", NOON).goal).toBe("stretch");
  });

  it("never repeats a relative reminder", () => {
    expect(parseWhen("20m break", NOON).repeatMs).toBeNull();
  });
});

describe("clock times", () => {
  it("takes the next occurrence of a 24h time", () => {
    const r = parseWhen("at 14:30 check the news", NOON);
    expect(new Date(r.at).getHours()).toBe(14);
    expect(new Date(r.at).getMinutes()).toBe(30);
    expect(r.at).toBeGreaterThan(NOON);
  });

  it("rolls a time already past today to tomorrow", () => {
    const r = parseWhen("8:00am morning brief", NOON);
    expect(r.at).toBeGreaterThan(NOON);
    expect(new Date(r.at).getDate()).toBe(23);
  });

  it("understands am and pm", () => {
    expect(new Date(parseWhen("at 9pm wind down", NOON).at).getHours()).toBe(21);
    expect(new Date(parseWhen("at 6am wake up", NOON).at).getHours()).toBe(6);
  });
});

describe("daily", () => {
  it("repeats every day at the given time", () => {
    const r = parseWhen("daily 7pm what's on tomorrow", NOON);
    expect(r.repeatMs).toBe(86400000);
    expect(new Date(r.at).getHours()).toBe(19);
    expect(r.goal).toBe("what's on tomorrow");
  });

  it("also accepts 'every day'", () => {
    expect(parseWhen("every day 9am the news", NOON).repeatMs).toBe(86400000);
  });
});

describe("tomorrow", () => {
  it("lands on the next day at the stated time", () => {
    const r = parseWhen("tomorrow 9am gym", NOON);
    expect(new Date(r.at).getDate()).toBe(23);
    expect(new Date(r.at).getHours()).toBe(9);
    expect(r.repeatMs).toBeNull();
  });
});

describe("things that are not a time", () => {
  it("returns null rather than guessing", () => {
    for (const bad of ["", "just do the thing", "sometime", "later maybe", "at some point soon"]) {
      expect(parseWhen(bad, NOON), bad).toBeNull();
    }
  });

  it("returns null when there is a time but no task", () => {
    expect(parseWhen("20m", NOON)).toBeNull();
    expect(parseWhen("at 9am", NOON)).toBeNull();
    expect(parseWhen("daily 9am", NOON)).toBeNull();
  });

  it("rejects an impossible clock time", () => {
    expect(parseWhen("at 25:00 do a thing", NOON)).toBeNull();
    expect(parseWhen("at 10:99 do a thing", NOON)).toBeNull();
  });
});

describe("describing a time back", () => {
  it("says today when it is today", () => {
    expect(describeWhen(NOON + 3600000, null, NOON)).toMatch(/today at/);
  });

  it("marks a daily reminder as recurring", () => {
    expect(describeWhen(NOON, 86400000, NOON)).toMatch(/every day at/);
  });
});
