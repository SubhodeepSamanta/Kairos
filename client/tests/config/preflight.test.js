import { describe, it, expect } from "vitest";
import { clientPreflight } from "../../src/config/preflight.js";

const deps = (browsers, chromium) => ({
  installedBrowsers: () => browsers,
  bundledChromiumInstalled: () => chromium
});

describe("clientPreflight", () => {
  it("passes when a real browser is installed even without bundled chromium", () => {
    const r = clientPreflight({ CLOUD_URL: "ws://localhost:3000" }, deps(["chrome"], false));
    expect(r.ok).toBe(true);
    expect(r.notes.join(" ")).toMatch(/chrome/);
  });

  it("passes with bundled chromium and no real browser", () => {
    const r = clientPreflight({}, deps([], true));
    expect(r.ok).toBe(true);
  });

  it("fails when no browser is available at all", () => {
    const r = clientPreflight({}, deps([], false));
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/playwright install chromium/);
  });

  it("notes auth state from CLIENT_SECRET", () => {
    expect(clientPreflight({ CLIENT_SECRET: "s" }, deps(["edge"], true)).notes.join(" ")).toMatch(/sending CLIENT_SECRET/);
    expect(clientPreflight({}, deps(["edge"], true)).notes.join(" ")).toMatch(/no CLIENT_SECRET/);
  });
});
