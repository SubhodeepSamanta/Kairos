import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "../../src/companion/commands.js";
import { markClientConnected, markConnector, markQueueDepth, runtimeStatus, formatDuration } from "../../src/runtime.js";
import { recordTrace, clearTrace, formatTrace } from "../../src/agent/trace.js";

beforeEach(() => {
  clearTrace();
  markClientConnected(false);
  markQueueDepth(0);
});

describe("/status", () => {
  it("says plainly when the laptop is not connected, because nothing browser-shaped can work", async () => {
    markClientConnected(false);
    const out = await runCommand("t", "/status");
    expect(out).toMatch(/NOT connected/);
    expect(out).toMatch(/cannot touch the browser/);
  });

  it("confirms the link when the laptop is there", async () => {
    markClientConnected(true);
    const out = await runCommand("t", "/status");
    expect(out).toMatch(/laptop connected/);
    expect(out).not.toMatch(/NOT connected/);
  });

  it("reports which build is running so a stale cloud is visible", async () => {
    const out = await runCommand("t", "/status");
    expect(out).toMatch(/cloud up /);
    const rev = runtimeStatus().revision;
    if (rev) expect(out).toContain(rev);
  });

  it("mentions goals that are waiting their turn", async () => {
    markQueueDepth(2);
    const out = await runCommand("t", "/status");
    expect(out).toMatch(/2 goals waiting/);
  });

  it("names the connectors that are attached", async () => {
    markConnector("cli", true);
    const out = await runCommand("t", "/status");
    expect(out).toMatch(/cli/);
    markConnector("cli", false);
  });
});

describe("/last", () => {
  it("admits nothing has run yet rather than inventing a trace", async () => {
    const out = await runCommand("t", "/last");
    expect(out).toMatch(/nothing has run yet/i);
  });

  it("walks through the steps she actually took", async () => {
    recordTrace({
      goal: "play lofi on youtube",
      success: true,
      answer: "playing",
      steps: ["#1 navigate url=youtube.com -> ok", "#2 type element=3 text=lofi -> ok"],
      seconds: "4.2",
      llmCalls: 3
    });

    const out = await runCommand("t", "/last");
    expect(out).toContain("play lofi on youtube");
    expect(out).toContain("worked");
    expect(out).toContain("#1 navigate");
    expect(out).toContain("#2 type");
    expect(out).toMatch(/3 AI calls/);
  });

  it("says it was stopped rather than claiming failure", () => {
    const trace = recordTrace({
      goal: "book a flight", success: false, cancelled: true,
      steps: ["#1 navigate -> ok"], seconds: "2.0", llmCalls: 1
    });
    expect(formatTrace(trace)).toContain("stopped");
    expect(formatTrace(trace)).not.toContain("did not work");
  });

  it("explains a pure conversation turn instead of showing an empty step list", () => {
    const trace = recordTrace({
      goal: "how are you", success: true, steps: [], seconds: "1.1", llmCalls: 1
    });
    expect(formatTrace(trace)).toMatch(/without touching the browser/);
  });
});

describe("formatDuration", () => {
  it("reads the way a person would say it", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(90000)).toBe("1m");
    expect(formatDuration(3600000 * 3 + 60000 * 20)).toBe("3h 20m");
    expect(formatDuration(86400000 * 2 + 3600000 * 5)).toBe("2d 5h");
  });
});
