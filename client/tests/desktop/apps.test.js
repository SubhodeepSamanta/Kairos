import { describe, it, expect, vi, afterEach } from "vitest";
import {
  pickApp,
  buildFocusScript,
  buildCloseScript,
  focusApp,
  closeApp,
  setPowerShellRunnerForTests
} from "../../src/automation/desktop/windows/apps.js";

const APPS = [
  { Name: "Notepad", AppID: "Microsoft.Notepad_8wekyb3d8bbwe!App" },
  { Name: "Calculator", AppID: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App" },
  { Name: "Visual Studio Code", AppID: "code" },
  { Name: "Notepad++", AppID: "npp" }
];

afterEach(() => setPowerShellRunnerForTests(null));

describe("pickApp", () => {
  it("prefers an exact name over a prefix or substring", () => {
    expect(pickApp(APPS, "notepad").Name).toBe("Notepad");
  });

  it("falls back to startsWith, then includes", () => {
    expect(pickApp(APPS, "visual").Name).toBe("Visual Studio Code");
    expect(pickApp(APPS, "code").Name).toBe("Visual Studio Code");
  });

  it("is case and whitespace insensitive", () => {
    expect(pickApp(APPS, "  CALCULATOR ").Name).toBe("Calculator");
  });

  it("returns null for no match or empty query", () => {
    expect(pickApp(APPS, "photoshop")).toBeNull();
    expect(pickApp(APPS, "")).toBeNull();
    expect(pickApp([], "notepad")).toBeNull();
  });
});

describe("script builders", () => {
  it("single-quote-escapes the app term to survive apostrophes", () => {
    const script = buildFocusScript("Bob's Editor");
    expect(script).toContain("$term='Bob''s Editor'");
  });

  it("focus script asks for the foreground window", () => {
    const script = buildFocusScript("Notepad");
    expect(script).toContain("SetForegroundWindow");
    expect(script).toContain("MainWindowHandle");
  });

  it("close script tries a graceful CloseMainWindow", () => {
    const script = buildCloseScript("Notepad");
    expect(script).toContain("CloseMainWindow");
    expect(script).toContain("closed:");
  });
});

describe("focusApp", () => {
  it("reports the focused window title on success", async () => {
    setPowerShellRunnerForTests(async () => ({ err: null, stdout: "Untitled - Notepad\n" }));
    expect(await focusApp("notepad")).toEqual({ success: true, app: "notepad", focused: "Untitled - Notepad" });
  });

  it("fails honestly when no window matched", async () => {
    setPowerShellRunnerForTests(async () => ({ err: null, stdout: "notfound\n" }));
    const r = await focusApp("photoshop");
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/no open window/);
  });
});

describe("closeApp", () => {
  it("succeeds when a window actually closed", async () => {
    setPowerShellRunnerForTests(async () => ({ err: null, stdout: "closed:1\n" }));
    expect(await closeApp("notepad")).toEqual({ success: true, app: "notepad", closed: true });
  });

  it("does not claim success when nothing closed (e.g. a save dialog blocked it)", async () => {
    setPowerShellRunnerForTests(async () => ({ err: null, stdout: "closed:0\n" }));
    const r = await closeApp("notepad");
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/did not close/);
  });

  it("reports when no matching window exists", async () => {
    setPowerShellRunnerForTests(async () => ({ err: null, stdout: "notfound\n" }));
    expect((await closeApp("ghost")).reason).toMatch(/no open window/);
  });
});
