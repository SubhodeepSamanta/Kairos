import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { storeSecret, hasSecret, resolveSecrets, resetVaultCacheForTests } from "../../src/secrets/vault.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-vault-"));
const originalCwd = process.cwd();

beforeEach(() => {
  process.chdir(tmpDir);
  fs.rmSync(path.join(tmpDir, "data"), { recursive: true, force: true });
  resetVaultCacheForTests();
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("secrets vault", () => {
  it("stores and resolves placeholders", () => {
    storeSecret("github_password", "hunter2");
    const { resolved, missing, containedSecret } = resolveSecrets("pw is {{secret:github_password}}");
    expect(resolved).toBe("pw is hunter2");
    expect(missing).toEqual([]);
    expect(containedSecret).toBe(true);
  });

  it("normalizes names", () => {
    storeSecret("GitHub Password", "x");
    expect(hasSecret("github_password")).toBe(true);
  });

  it("finds a multi-word secret by the same spelling it was stored with", () => {
    storeSecret("My Email", "a@b.com");
    expect(hasSecret("My Email")).toBe(true);
    expect(hasSecret("my email")).toBe(true);
  });

  it("reports missing secrets without substituting", () => {
    const { resolved, missing } = resolveSecrets("{{secret:unknown_token}}");
    expect(missing).toEqual(["unknown_token"]);
    expect(resolved).toContain("{{secret:unknown_token}}");
  });

  it("passes through text without placeholders", () => {
    const { resolved, missing, containedSecret } = resolveSecrets("plain text");
    expect(resolved).toBe("plain text");
    expect(missing).toEqual([]);
    expect(containedSecret).toBe(false);
  });

  it("persists across cache resets", () => {
    storeSecret("a", "1");
    resetVaultCacheForTests();
    expect(hasSecret("a")).toBe(true);
  });

  it("rejects empty names or values", () => {
    expect(storeSecret("", "x")).toBe(false);
    expect(storeSecret("k", "")).toBe(false);
  });
});
