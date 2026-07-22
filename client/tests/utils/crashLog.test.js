import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { formatCrash, appendCrash } from "../../src/utils/crashLog.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-crash-"));

describe("crash log", () => {
  it("formats an error with its stack", () => {
    const entry = formatCrash("uncaughtException", new Error("boom"));
    expect(entry).toContain("uncaughtException");
    expect(entry).toContain("boom");
    expect(entry).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("formats a non-error rejection reason", () => {
    expect(formatCrash("unhandledRejection", "just a string")).toContain("just a string");
    expect(formatCrash("unhandledRejection", undefined)).toContain("undefined");
  });

  it("appends to the file across crashes", () => {
    const file = path.join(tmp, "crash.log");
    expect(appendCrash("uncaughtException", new Error("first"), file)).toBe(true);
    expect(appendCrash("unhandledRejection", new Error("second"), file)).toBe(true);
    const written = fs.readFileSync(file, "utf8");
    expect(written).toContain("first");
    expect(written).toContain("second");
  });

  it("caps the file instead of growing forever", () => {
    const file = path.join(tmp, "big.log");
    appendCrash("uncaughtException", new Error("x".repeat(300000)), file);
    appendCrash("uncaughtException", new Error("latest"), file);
    const written = fs.readFileSync(file, "utf8");
    expect(written.length).toBeLessThanOrEqual(200000);
    expect(written).toContain("latest");
  });

  it("never throws even when the path is unwritable", () => {
    expect(appendCrash("uncaughtException", new Error("x"), path.join(tmp, "crash.log", "impossible", "f.log"))).toBe(false);
  });
});
