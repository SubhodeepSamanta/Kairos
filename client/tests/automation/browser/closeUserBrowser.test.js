import { describe, it, expect, vi, beforeEach } from "vitest";

const execCalls = [];
let runningResponses = [];

vi.mock("child_process", () => ({
  execFile: vi.fn((cmd, args, opts, cb) => {
    execCalls.push({ cmd, args });
    if (cmd === "tasklist") {
      const running = runningResponses.length ? runningResponses.shift() : false;
      const exe = String(args[1]).replace("IMAGENAME eq ", "");
      cb(null, running ? `${exe}    1234 Console` : "INFO: No tasks are running");
    } else {
      cb(null, "");
    }
  })
}));

process.env.KAIROS_CLOSE_WAIT_MS = "1200";
const { closeUserBrowser } = await import("../../../src/automation/browser/closeUserBrowser.js");

beforeEach(() => {
  execCalls.length = 0;
  runningResponses = [];
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

describe("closeUserBrowser", () => {
  it("refuses off windows", async () => {
    const result = await onPlatform("linux", () => closeUserBrowser("chrome"));
    expect(result.success).toBe(false);
    expect(execCalls.length).toBe(0);
  });

  it("rejects unknown browsers", async () => {
    const result = await onPlatform("win32", () => closeUserBrowser("firefox"));
    expect(result.success).toBe(false);
    expect(result.reason).toContain("unknown browser");
  });

  it("reports closed:false when the browser was not running", async () => {
    runningResponses = [false];
    const result = await onPlatform("win32", () => closeUserBrowser("chrome"));
    expect(result).toMatchObject({ success: true, closed: false });
    expect(execCalls.some(c => c.cmd === "taskkill")).toBe(false);
  });

  it("closes gracefully without ever forcing when the browser exits", async () => {
    runningResponses = [true, false];
    const result = await onPlatform("win32", () => closeUserBrowser("chrome"));
    expect(result).toMatchObject({ success: true, closed: true });
    const kills = execCalls.filter(c => c.cmd === "taskkill");
    expect(kills.length).toBe(1);
    expect(kills[0].args).toEqual(["/IM", "chrome.exe"]);
  });

  it("falls back to a forced close when graceful does not work", async () => {
    runningResponses = Array(4).fill(true);
    const result = await onPlatform("win32", () => closeUserBrowser("edge"));
    expect(result).toMatchObject({ success: true, closed: true, forced: true });
    const kills = execCalls.filter(c => c.cmd === "taskkill");
    expect(kills[0].args).toEqual(["/IM", "msedge.exe"]);
    expect(kills[1].args).toEqual(["/F", "/IM", "msedge.exe"]);
  }, 30000);
});
