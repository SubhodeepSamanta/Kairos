import { describe, it, expect, vi } from "vitest";

const calls = [];
vi.mock("child_process", () => ({
  execFile: (cmd, args, opts, cb) => {
    calls.push({ cmd, args });
    cb(null);
  }
}));

const { openForUser } = await import("../../../../src/automation/browser/actions/openForUser.js");

describe("open_for_user", () => {
  it("hands a normal url to the OS default browser", async () => {
    const result = await openForUser("https://example.com/watch?v=abc&t=10");
    expect(result.success).toBe(true);
    expect(result.opened).toBe("https://example.com/watch?v=abc&t=10");
    expect(calls[0].cmd).toBe("rundll32");
    expect(calls[0].args[1]).toBe("https://example.com/watch?v=abc&t=10");
  });

  it("rejects non-http urls and quote smuggling", async () => {
    expect((await openForUser("file:///C:/secret")).success).toBe(false);
    expect((await openForUser('https://x.com/" --evil')).success).toBe(false);
    expect((await openForUser("")).success).toBe(false);
  });
});
