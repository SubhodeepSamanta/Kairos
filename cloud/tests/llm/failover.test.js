import { describe, it, expect, vi, beforeEach } from "vitest";

const callModel = vi.fn();
vi.mock("../../src/llm/models.js", () => ({
  callModel: (...a) => callModel(...a),
  MAX_OUTPUT_TOKENS: 1024
}));

const { askLLM, resetProviderStateForTests } = await import("../../src/llm/provider.js");

beforeEach(() => {
  callModel.mockReset();
  resetProviderStateForTests();
});

describe("telling a dead connection apart from busy providers", () => {
  it("calls a whole outage unreachable, not busy", async () => {
    callModel.mockRejectedValue(new Error("fetch failed"));
    await expect(askLLM("s", "u")).rejects.toMatchObject({ code: "unreachable" });
  });

  it("calls a timeout abort unreachable too", async () => {
    callModel.mockRejectedValue(new Error("This operation was aborted"));
    await expect(askLLM("s", "u")).rejects.toMatchObject({ code: "unreachable" });
  });

  it("calls rate limits busy, because the provider actually answered", async () => {
    callModel.mockImplementation(async () => {
      const err = new Error("groq 429: rate limit exceeded");
      err.status = 429;
      err.rateLimited = true;
      throw err;
    });
    await expect(askLLM("s", "u")).rejects.toMatchObject({ code: "busy" });
  });

  it("does not retry the same provider's other models once it is unreachable", async () => {
    const providers = [];
    callModel.mockImplementation(async ({ provider }) => {
      providers.push(provider);
      throw new Error("fetch failed");
    });
    await expect(askLLM("s", "u")).rejects.toMatchObject({ code: "unreachable" });
    expect(providers.filter(p => p === "groq")).toHaveLength(1);
    expect(providers).toContain("openrouter");
  });

  it("still returns the answer when a provider replies", async () => {
    callModel.mockResolvedValue({ text: "hello", usage: null, ms: 5 });
    expect(await askLLM("s", "u")).toBe("hello");
  });
});
