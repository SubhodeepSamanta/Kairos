import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { readJson, writeJsonAtomic } from "../../src/utils/jsonFile.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-json-"));

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("jsonFile", () => {
  it("writes and reads back", () => {
    const file = path.join(tmp, "a", "data.json");
    writeJsonAtomic(file, { hello: "world" });
    expect(readJson(file, {})).toEqual({ hello: "world" });
  });

  it("leaves no temp file behind", () => {
    const file = path.join(tmp, "clean.json");
    writeJsonAtomic(file, { x: 1 });
    const leftovers = fs.readdirSync(tmp).filter(f => f.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("replaces existing content completely", () => {
    const file = path.join(tmp, "replace.json");
    writeJsonAtomic(file, { a: 1, b: 2 });
    writeJsonAtomic(file, { c: 3 });
    expect(readJson(file, {})).toEqual({ c: 3 });
  });

  it("falls back on corrupt or missing files", () => {
    const file = path.join(tmp, "corrupt.json");
    fs.writeFileSync(file, "{ not json !!", "utf8");
    expect(readJson(file, { safe: true })).toEqual({ safe: true });
    expect(readJson(path.join(tmp, "missing.json"), null)).toBeNull();
  });
});
