import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../../src/agent/prompt.js";

describe("open/play goals must actually act", () => {
  it("states that reciting a url is not doing it", () => {
    expect(SYSTEM_PROMPT).toContain("Reciting a URL is NOT doing it");
  });

  it("forbids answering an open goal with a link", () => {
    expect(SYSTEM_PROMPT).toContain("never answer an open/play goal with just a link");
  });

  it("does not let past conversation stand in for acting now", () => {
    expect(SYSTEM_PROMPT).toContain("Past CONVERSATION never proves it");
    expect(SYSTEM_PROMPT).toContain("a repeated open request acts again");
  });

  it("requires a real opening action for open goals", () => {
    expect(SYSTEM_PROMPT).toContain("open_for_user{url}, done");
    expect(SYSTEM_PROMPT).toContain("the controlled browser: navigate");
  });

  it("teaches the profile-lock reality and the consented takeover flow", () => {
    expect(SYSTEM_PROMPT).toContain("locks ALL its real profiles");
    expect(SYSTEM_PROMPT).toContain("trying another real profile won't help");
    expect(SYSTEM_PROMPT).toContain("close_user_browser");
    expect(SYSTEM_PROMPT).toContain("ONLY after they said yes to ask_human");
  });

  it("bans open_for_user for play/watch goals and distrusts recalled video ids", () => {
    expect(SYSTEM_PROMPT).toContain("NEVER open_for_user for play/watch");
    expect(SYSTEM_PROMPT).toContain("video ids you recall may be dead");
    expect(SYSTEM_PROMPT).toContain("unavailable → pick another result");
  });

  it("does not let the have-the-answer rule excuse skipping actions", () => {
    expect(SYSTEM_PROMPT).toContain("never excuses skipping an action you have not run");
  });

  it("keeps done gated on proof of the thing actually opening", () => {
    expect(SYSTEM_PROMPT).toContain("done ONLY when the CURRENT PAGE proves it (or open_for_user succeeded)");
  });
});
