import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const llmCalls = [];
let llmReply = "They're grinding DSA, prefers lofi while working, skipped leetcode twice this week.";

vi.mock("../../src/llm/provider.js", () => ({
  askLLM: vi.fn(async (system, user) => {
    llmCalls.push({ system, user });
    return llmReply;
  })
}));

const { addTurn, getSummary, resetCompanionCacheForTests } = await import("../../src/companion/store.js");
const { maybeSummarize } = await import("../../src/companion/summary.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kairos-sum-"));
const originalCwd = process.cwd();

beforeEach(() => {
  process.chdir(tmp);
  fs.rmSync(path.join(tmp, "data"), { recursive: true, force: true });
  resetCompanionCacheForTests();
  llmCalls.length = 0;
  llmReply = "They're grinding DSA, prefers lofi while working, skipped leetcode twice this week.";
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function seed(chatId, n) {
  for (let i = 0; i < n; i++) await addTurn(chatId, i % 2 ? "assistant" : "user", `message ${i}`);
}

describe("maybeSummarize", () => {
  it("does nothing for a short conversation", async () => {
    await seed("a", 6);
    const text = await maybeSummarize("a");
    expect(llmCalls).toHaveLength(0);
    expect(text).toBe("");
  });

  it("summarizes once the conversation is long enough", async () => {
    await seed("a", 30);
    const text = await maybeSummarize("a");
    expect(llmCalls).toHaveLength(1);
    expect(text).toContain("DSA");
    expect((await getSummary("a")).text).toContain("DSA");
  });

  it("only summarizes turns outside the live window", async () => {
    await seed("a", 30);
    await maybeSummarize("a");
    const sent = llmCalls[0].user;
    expect(sent).toContain("message 0");
    expect(sent).not.toContain("message 29");
  });

  it("does not re-summarize until enough new turns arrive", async () => {
    await seed("a", 30);
    await maybeSummarize("a");
    expect(llmCalls).toHaveLength(1);

    await addTurn("a", "user", "one more");
    await maybeSummarize("a");
    expect(llmCalls).toHaveLength(1);

    await seed("a", 12);
    await maybeSummarize("a");
    expect(llmCalls).toHaveLength(2);
  });

  it("feeds the previous summary back in so memory compounds", async () => {
    await seed("a", 30);
    await maybeSummarize("a");
    await seed("a", 12);
    await maybeSummarize("a");
    expect(llmCalls[1].user).toContain("What you remembered so far");
    expect(llmCalls[1].user).toContain("DSA");
  });

  it("keeps the old summary when the model says NOTHING", async () => {
    await seed("a", 30);
    await maybeSummarize("a");
    llmReply = "NOTHING";
    await seed("a", 12);
    const text = await maybeSummarize("a");
    expect(text).toContain("DSA");
  });

  it("never loses the summary when the model errors", async () => {
    await seed("a", 30);
    await maybeSummarize("a");
    const provider = await import("../../src/llm/provider.js");
    provider.askLLM.mockRejectedValueOnce(new Error("all providers down"));
    await seed("a", 12);
    const text = await maybeSummarize("a");
    expect(text).toContain("DSA");
  });

  it("keeps summaries separate per chat", async () => {
    await seed("a", 30);
    await maybeSummarize("a");
    expect((await getSummary("b")).text).toBe("");
  });
});
