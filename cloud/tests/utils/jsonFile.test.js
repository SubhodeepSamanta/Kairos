import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { readJson, writeJsonAtomic, sweepStaleTemps } from "../../src/utils/jsonFile.js";

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-json-")); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe("atomic json files", () => {
  it("writes and reads back", () => {
    const file = path.join(dir, "x.json");
    writeJsonAtomic(file, { a: 1 });
    expect(readJson(file, null)).toEqual({ a: 1 });
  });

  it("leaves no temp file behind on a normal write", () => {
    writeJsonAtomic(path.join(dir, "x.json"), { a: 1 });
    expect(fs.readdirSync(dir).filter(f => f.endsWith(".tmp"))).toHaveLength(0);
  });

  it("falls back rather than throwing on unreadable json", () => {
    const file = path.join(dir, "bad.json");
    fs.writeFileSync(file, "{not json");
    expect(readJson(file, { safe: true })).toEqual({ safe: true });
  });

  it("sweeps temp files left behind by a killed process", () => {
    const stale = path.join(dir, "turns.json.999.tmp");
    fs.writeFileSync(stale, "{}");
    const old = Date.now() - 10 * 60 * 1000;
    fs.utimesSync(stale, old / 1000, old / 1000);

    expect(sweepStaleTemps(dir)).toBe(1);
    expect(fs.existsSync(stale)).toBe(false);
  });

  it("leaves a temp file that another live write may still be using", () => {
    const fresh = path.join(dir, "turns.json.111.tmp");
    fs.writeFileSync(fresh, "{}");
    expect(sweepStaleTemps(dir)).toBe(0);
    expect(fs.existsSync(fresh)).toBe(true);
  });

  it("does not touch real data files", () => {
    const real = path.join(dir, "turns.json");
    fs.writeFileSync(real, "{}");
    const old = Date.now() - 10 * 60 * 1000;
    fs.utimesSync(real, old / 1000, old / 1000);
    sweepStaleTemps(dir);
    expect(fs.existsSync(real)).toBe(true);
  });

  it("shrugs at a directory that is not there", () => {
    expect(sweepStaleTemps(path.join(dir, "nope"))).toBe(0);
  });
});
