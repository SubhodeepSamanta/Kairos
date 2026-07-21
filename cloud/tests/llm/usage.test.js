import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { recordTrace, clearTrace, formatTrace } from "../../src/agent/trace.js";
import { createBudget } from "../../src/llm/provider.js";

beforeEach(() => clearTrace());
afterEach(() => { delete process.env.LLM_COST_PER_MTOK; });

describe("a budget", () => {
  it("starts with room to measure real usage, not just guesses", () => {
    const b = createBudget(45);
    expect(b).toMatchObject({ used: 0, maxCalls: 45, tokensIn: 0, tokensOut: 0, measured: 0, llmMs: 0 });
  });
});

describe("what /last reports about cost", () => {
  it("shows real token counts split in and out when the provider told us", () => {
    const t = recordTrace({
      goal: "play lofi", success: true, steps: ["#1 navigate -> ok"],
      seconds: "4.0", llmCalls: 2, tokens: 1900, tokensIn: 1700, tokensOut: 200,
      measured: true, llmMs: 2400
    });
    const out = formatTrace(t);
    expect(out).toContain("1900 tokens");
    expect(out).toContain("1700 in, 200 out");
    expect(out).not.toContain("estimated");
  });

  it("says plainly when the number is only an estimate", () => {
    const t = recordTrace({
      goal: "play lofi", success: true, steps: ["#1 navigate -> ok"],
      seconds: "4.0", llmCalls: 2, tokens: 1800, measured: false
    });
    expect(formatTrace(t)).toContain("~1800 tokens (estimated)");
  });

  it("separates time spent waiting on the AI from wall clock", () => {
    const t = recordTrace({
      goal: "x", success: true, steps: ["#1 navigate -> ok"],
      seconds: "9.0", llmCalls: 3, tokens: 100, tokensIn: 90, tokensOut: 10,
      measured: true, llmMs: 3500
    });
    const out = formatTrace(t);
    expect(out).toContain("9.0s");
    expect(out).toContain("3.5s of that waiting on the AI");
  });

  it("reports money only when a rate is configured", () => {
    const base = {
      goal: "x", success: true, steps: ["#1 navigate -> ok"],
      seconds: "1", llmCalls: 1, tokens: 1000000, tokensIn: 900000, tokensOut: 100000, measured: true
    };
    expect(formatTrace(recordTrace(base))).not.toContain("$");

    process.env.LLM_COST_PER_MTOK = "0.60";
    expect(formatTrace(recordTrace(base))).toContain("$0.6000");
  });

  it("never invents a cost from estimated tokens", () => {
    process.env.LLM_COST_PER_MTOK = "0.60";
    const t = recordTrace({
      goal: "x", success: true, steps: [], seconds: "1", llmCalls: 1,
      tokens: 1000000, measured: false
    });
    expect(t.cost).toBeNull();
    expect(formatTrace(t)).not.toContain("$");
  });
});
