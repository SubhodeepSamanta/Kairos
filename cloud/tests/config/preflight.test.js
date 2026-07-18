import { describe, it, expect } from "vitest";
import { cloudPreflight } from "../../src/config/preflight.js";

describe("cloudPreflight", () => {
  it("fails clearly when no LLM key is set", () => {
    const r = cloudPreflight({ CLIENT_SECRET: "x" });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/LLM API key/i);
    expect(r.problems.join(" ")).toMatch(/groq/i);
  });

  it("passes with any one LLM key", () => {
    expect(cloudPreflight({ GROQ_API_KEY: "gsk_x" }).ok).toBe(true);
    expect(cloudPreflight({ OPENROUTER_API_KEY: "sk-x" }).ok).toBe(true);
    expect(cloudPreflight({ NVIDIA_API_KEY: "nv-x" }).ok).toBe(true);
  });

  it("treats blank/whitespace keys as missing", () => {
    expect(cloudPreflight({ GROQ_API_KEY: "   " }).ok).toBe(false);
  });

  it("notes auth off when secret is blank", () => {
    const r = cloudPreflight({ GROQ_API_KEY: "gsk_x" });
    expect(r.notes.join(" ")).toMatch(/Auth: OFF/i);
  });

  it("reports telegram and memory backend in notes", () => {
    const withExtras = cloudPreflight({ GROQ_API_KEY: "x", TELEGRAM_BOT_TOKEN: "t", DATABASE_URL: "postgres://" });
    expect(withExtras.notes.join(" ")).toMatch(/Telegram: enabled/);
    expect(withExtras.notes.join(" ")).toMatch(/Postgres/);
    const bare = cloudPreflight({ GROQ_API_KEY: "x" });
    expect(bare.notes.join(" ")).toMatch(/CLI only/);
    expect(bare.notes.join(" ")).toMatch(/local JSON/);
  });
});
