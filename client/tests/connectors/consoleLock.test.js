import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { claimConsole, releaseConsole, consoleAlreadyOpen } from "../../src/connectors/cli/lock.js";
import { launchConsole } from "../../src/connectors/cli/launcher.js";

const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), "kairos-lock-"));

describe("console lock", () => {
  it("claims when nothing holds it", () => {
    const dir = fresh();
    expect(claimConsole(dir)).toBe(true);
    expect(fs.readFileSync(path.join(dir, "console.lock"), "utf8")).toBe(String(process.pid));
  });

  it("its own claim does not count as another window", () => {
    const dir = fresh();
    claimConsole(dir);
    expect(consoleAlreadyOpen(dir)).toBe(false);
    expect(claimConsole(dir)).toBe(true);
  });

  it("refuses while another live process holds it", () => {
    const dir = fresh();
    fs.writeFileSync(path.join(dir, "console.lock"), String(process.ppid), "utf8");
    expect(consoleAlreadyOpen(dir)).toBe(true);
    expect(claimConsole(dir)).toBe(false);
  });

  it("steals a lock left behind by a dead process", () => {
    const dir = fresh();
    fs.writeFileSync(path.join(dir, "console.lock"), "999999999", "utf8");
    expect(consoleAlreadyOpen(dir)).toBe(false);
    expect(claimConsole(dir)).toBe(true);
  });

  it("ignores junk in the lock file", () => {
    const dir = fresh();
    fs.writeFileSync(path.join(dir, "console.lock"), "not a pid", "utf8");
    expect(consoleAlreadyOpen(dir)).toBe(false);
    expect(claimConsole(dir)).toBe(true);
  });

  it("releases only its own lock", () => {
    const dir = fresh();
    claimConsole(dir);
    releaseConsole(dir);
    expect(fs.existsSync(path.join(dir, "console.lock"))).toBe(false);

    fs.writeFileSync(path.join(dir, "console.lock"), String(process.ppid), "utf8");
    releaseConsole(dir);
    expect(fs.existsSync(path.join(dir, "console.lock"))).toBe(true);
  });
});

describe("console launcher", () => {
  function spawner(calls) {
    return (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { unref: () => {} };
    };
  }

  it("opens one new window running the console", () => {
    const root = fresh();
    const calls = [];
    const result = launchConsole({ spawner: spawner(calls), root, platform: "win32" });

    expect(result.opened).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("cmd.exe");
    expect(calls[0].args).toContain("start");
    expect(calls[0].args.at(-1)).toBe(path.join(root, "src", "connectors", "cli", "index.js"));
    expect(calls[0].opts.cwd).toBe(root);
    expect(calls[0].opts.detached).toBe(true);
  });

  it("passes the voice flag into the new window", () => {
    const root = fresh();
    const calls = [];
    launchConsole({ voice: true, spawner: spawner(calls), root, platform: "win32" });
    expect(calls[0].opts.env.VOICE).toBe("1");
  });

  it("does not force voice on when it was not asked for", () => {
    const root = fresh();
    const calls = [];
    const hadVoice = process.env.VOICE;
    delete process.env.VOICE;
    launchConsole({ spawner: spawner(calls), root, platform: "win32" });
    if (hadVoice !== undefined) process.env.VOICE = hadVoice;
    expect(calls[0].opts.env.VOICE).toBeUndefined();
  });

  it("refuses a second window while one is open", () => {
    const root = fresh();
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.writeFileSync(path.join(root, "data", "console.lock"), String(process.ppid), "utf8");

    const calls = [];
    const result = launchConsole({ spawner: spawner(calls), root, platform: "win32" });
    expect(result).toEqual({ opened: false, reason: "already-open" });
    expect(calls).toHaveLength(0);
  });

  it("falls back to the same terminal off windows", () => {
    const root = fresh();
    const calls = [];
    const result = launchConsole({ spawner: spawner(calls), root, platform: "linux" });
    expect(result).toEqual({ opened: false, reason: "no-window" });
    expect(calls).toHaveLength(0);
  });
});
