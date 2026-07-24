import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/automation/desktop/windows/uia.js", () => ({
  bridgeInvoke: vi.fn(async () => ({ done: true })),
  bridgeSetValue: vi.fn(async () => ({ done: true })),
  bridgeToggle: vi.fn(async () => ({ done: true })),
  bridgeSelect: vi.fn(async () => ({ done: true })),
  bridgeKeys: vi.fn(async () => ({ sent: true }))
}));
vi.mock("../../src/secrets/vault.js", () => ({ resolveSecrets: vi.fn() }));

import * as bridge from "../../src/automation/desktop/windows/uia.js";
import { resolveSecrets } from "../../src/secrets/vault.js";
import { clickElement, typeInto, setToggle, selectMenu, pressKeys } from "../../src/automation/desktop/windows/act.js";
import { resetDesktop, registerDesktopElement } from "../../src/automation/desktop/registry.js";

beforeEach(() => {
  bridge.bridgeInvoke.mockClear();
  bridge.bridgeSetValue.mockClear();
  bridge.bridgeToggle.mockClear();
  bridge.bridgeSelect.mockClear();
  bridge.bridgeKeys.mockClear();
  resolveSecrets.mockReset();
  resetDesktop({ title: "Notepad" });
  registerDesktopElement(1, { ref: 5, name: "Save" });
  registerDesktopElement(2, { ref: 3, name: "" });
});

describe("clickElement", () => {
  it("invokes the mapped ref and returns the label", async () => {
    const r = await clickElement(1);
    expect(bridge.bridgeInvoke).toHaveBeenCalledWith(5, expect.any(Number));
    expect(r).toMatchObject({ success: true, id: 1, label: "Save" });
  });

  it("fails honestly on an unknown id without touching the bridge", async () => {
    const r = await clickElement(99);
    expect(bridge.bridgeInvoke).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/read_desktop again/);
  });
});

describe("typeInto", () => {
  it("sets the resolved value and presses enter on submit", async () => {
    resolveSecrets.mockReturnValue({ resolved: "hello world", missing: [], containedSecret: false });
    const r = await typeInto(2, "hello world", true);
    expect(bridge.bridgeSetValue).toHaveBeenCalledWith(3, "hello world", expect.any(Number));
    expect(bridge.bridgeKeys).toHaveBeenCalledWith("{ENTER}", expect.any(Number));
    expect(r).toMatchObject({ success: true, submitted: true, text: "hello world" });
  });

  it("passes the real secret to the bridge but masks it in the result", async () => {
    resolveSecrets.mockReturnValue({ resolved: "hunter2", missing: [], containedSecret: true });
    const r = await typeInto(2, "{{secret:pw}}", false);
    expect(bridge.bridgeSetValue).toHaveBeenCalledWith(3, "hunter2", expect.any(Number));
    expect(r.text).toBe("•••••");
    expect(JSON.stringify(r)).not.toContain("hunter2");
  });

  it("refuses when a secret is missing and never calls the bridge", async () => {
    resolveSecrets.mockReturnValue({ resolved: "{{secret:pw}}", missing: ["pw"], containedSecret: false });
    const r = await typeInto(2, "{{secret:pw}}", false);
    expect(bridge.bridgeSetValue).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/missing_secret:pw/);
  });
});

describe("setToggle / selectMenu / pressKeys", () => {
  it("toggles to the requested state", async () => {
    const r = await setToggle(1, false);
    expect(bridge.bridgeToggle).toHaveBeenCalledWith(5, false, expect.any(Number));
    expect(r).toMatchObject({ success: true, on: false });
  });

  it("selects a menu value", async () => {
    const r = await selectMenu(1, "Large");
    expect(bridge.bridgeSelect).toHaveBeenCalledWith(5, "Large", expect.any(Number));
    expect(r.selected).toBe("Large");
  });

  it("translates a chord before sending keys", async () => {
    const r = await pressKeys("Ctrl+S");
    expect(bridge.bridgeKeys).toHaveBeenCalledWith("^s", expect.any(Number));
    expect(r.success).toBe(true);
  });
});
