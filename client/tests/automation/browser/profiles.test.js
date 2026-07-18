import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-prof-"));
const userData = path.join(tmp, "Google", "Chrome", "User Data");

fs.mkdirSync(path.join(userData, "Default"), { recursive: true });
fs.mkdirSync(path.join(userData, "Profile 1"), { recursive: true });
fs.mkdirSync(path.join(userData, "Profile 8"), { recursive: true });
fs.writeFileSync(
  path.join(userData, "Local State"),
  JSON.stringify({
    profile: {
      info_cache: {
        Default: { name: "Personal", user_name: "alice@example.com" },
        "Profile 1": { name: "Work", user_name: "bob@example.com" },
        "Profile 8": { name: "Side", user_name: "carol@example.com" },
        "Profile 99": { name: "Ghost", user_name: null }
      }
    }
  })
);

process.env.LOCALAPPDATA = tmp;
const { listProfiles, resolveProfile, automationDataDir, describeBrowsers, seedProfileIdentity, defaultProfile } = await import(
  "../../../src/automation/browser/profiles.js"
);

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("listProfiles", () => {
  it("reads profiles from Local State and skips ones with no directory on disk", () => {
    const profiles = listProfiles("chrome");
    expect(profiles.map(p => p.directory)).toEqual(["Default", "Profile 1", "Profile 8"]);
    expect(profiles.find(p => p.directory === "Profile 8").name).toBe("Side");
  });

  it("returns empty for a browser with no Local State", () => {
    expect(listProfiles("brave")).toEqual([]);
  });

  it("returns empty for an unknown browser", () => {
    expect(listProfiles("netscape")).toEqual([]);
  });
});

describe("resolveProfile", () => {
  it("defaults to the first profile", () => {
    expect(resolveProfile("chrome", null).directory).toBe("Default");
  });

  it("resolves by display name, case-insensitively", () => {
    expect(resolveProfile("chrome", "side").directory).toBe("Profile 8");
  });

  it("prefers exact name match over partial", () => {
    expect(resolveProfile("chrome", "Side").directory).toBe("Profile 8");
    expect(resolveProfile("chrome", "Work").directory).toBe("Profile 1");
  });

  it("resolves by account email", () => {
    expect(resolveProfile("chrome", "bob@example.com").directory).toBe("Profile 1");
  });

  it("resolves by directory name", () => {
    expect(resolveProfile("chrome", "Profile 8").name).toBe("Side");
  });

  it("resolves ordinals", () => {
    expect(resolveProfile("chrome", "first").directory).toBe("Default");
    expect(resolveProfile("chrome", "second").directory).toBe("Profile 1");
  });

  it("returns null for no match", () => {
    expect(resolveProfile("chrome", "nonexistent person")).toBeNull();
  });
});

describe("automationDataDir", () => {
  it("is a Kairos-owned dir, never the user's real User Data dir", () => {
    const dir = automationDataDir("chrome");
    expect(dir).toContain(path.join("Kairos", "Browsers"));
    expect(dir).not.toContain(path.join("Google", "Chrome", "User Data"));
    expect(automationDataDir("brave")).not.toBe(automationDataDir("chrome"));
  });
});

describe("defaultProfile", () => {
  const statePath = path.join(userData, "Local State");

  it("falls back to the Default directory when no last_used is recorded", () => {
    expect(defaultProfile("chrome").directory).toBe("Default");
  });

  it("prefers the profile the user last used", () => {
    const original = fs.readFileSync(statePath, "utf8");
    const state = JSON.parse(original);
    state.profile.last_used = "Profile 8";
    fs.writeFileSync(statePath, JSON.stringify(state));
    expect(defaultProfile("chrome").name).toBe("Side");
    fs.writeFileSync(statePath, original);
  });

  it("returns null when the browser has no profiles", () => {
    expect(defaultProfile("brave")).toBeNull();
  });
});

describe("seedProfileIdentity", () => {
  const prefsPath = (dir) => path.join(dir, "Default", "Preferences");

  it("names a fresh Kairos profile so the window is recognizable", () => {
    const dir = path.join(tmp, "seed-fresh");
    expect(seedProfileIdentity(dir, "Kairos")).toBe(true);
    const prefs = JSON.parse(fs.readFileSync(prefsPath(dir), "utf8"));
    expect(prefs.profile.name).toBe("Kairos");
  });

  it("renames Chrome's default placeholder name", () => {
    const dir = path.join(tmp, "seed-placeholder");
    fs.mkdirSync(path.join(dir, "Default"), { recursive: true });
    fs.writeFileSync(prefsPath(dir), JSON.stringify({ profile: { name: "Person 1" }, other: { keep: 1 } }));
    expect(seedProfileIdentity(dir, "Kairos")).toBe(true);
    const prefs = JSON.parse(fs.readFileSync(prefsPath(dir), "utf8"));
    expect(prefs.profile.name).toBe("Kairos");
    expect(prefs.other.keep).toBe(1);
  });

  it("never overwrites a name the user chose themselves", () => {
    const dir = path.join(tmp, "seed-custom");
    fs.mkdirSync(path.join(dir, "Default"), { recursive: true });
    fs.writeFileSync(prefsPath(dir), JSON.stringify({ profile: { name: "My Setup" } }));
    expect(seedProfileIdentity(dir, "Kairos")).toBe(false);
    const prefs = JSON.parse(fs.readFileSync(prefsPath(dir), "utf8"));
    expect(prefs.profile.name).toBe("My Setup");
  });
});

describe("describeBrowsers", () => {
  it("explains the private default and that real profiles need the browser closed", () => {
    const text = describeBrowsers();
    expect(text).toMatch(/private Kairos/i);
    expect(text).toMatch(/fully closed/i);
  });
});
