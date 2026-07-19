import { describe, it, expect, vi, beforeEach } from "vitest";

const execCalls = [];
let execResult = { err: null, stdout: "1\n" };

vi.mock("child_process", () => ({
  execFile: vi.fn((cmd, args, opts, cb) => {
    execCalls.push({ cmd, args, opts });
    cb(execResult.err, execResult.stdout);
  })
}));

import { releaseKairosLock } from "../../../src/automation/browser/kairosLock.js";
import { automationDataDir } from "../../../src/automation/browser/profiles.js";

beforeEach(() => {
  execCalls.length = 0;
  execResult = { err: null, stdout: "1\n" };
});

async function onPlatform(platform, fn) {
  const original = process.platform;
  Object.defineProperty(process, "platform", { value: platform });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, "platform", { value: original });
  }
}

describe("releaseKairosLock", () => {
  it("does nothing off windows", async () => {
    await onPlatform("linux", async () => {
      expect(await releaseKairosLock("chrome")).toBe(false);
      expect(execCalls.length).toBe(0);
    });
  });

  it("kills only browser processes holding the Kairos data dir", async () => {
    const released = await onPlatform("win32", () => releaseKairosLock("chrome"));
    expect(released).toBe(true);
    expect(execCalls.length).toBe(1);
    const { cmd, args, opts } = execCalls[0];
    expect(cmd).toBe("powershell.exe");
    const script = args[args.length - 1];
    expect(script).toContain(automationDataDir("chrome"));
    expect(script).toContain("Name='chrome.exe'");
    expect(script).toContain("Stop-Process");
    expect(script).toContain("CommandLine -like");
    expect(opts.windowsHide).toBe(true);
  });

  it("reports false when nothing was holding the lock", async () => {
    execResult = { err: null, stdout: "0\n" };
    expect(await onPlatform("win32", () => releaseKairosLock("chrome"))).toBe(false);
  });

  it("reports false instead of throwing when powershell fails", async () => {
    execResult = { err: new Error("boom"), stdout: "" };
    expect(await onPlatform("win32", () => releaseKairosLock("chrome"))).toBe(false);
  });
});
