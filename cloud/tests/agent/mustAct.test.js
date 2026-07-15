import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../../src/agent/prompt.js";

describe("open/play goals must actually act", () => {
  it("states that reciting a url is not doing it", () => {
    expect(SYSTEM_PROMPT).toContain("knowing or reciting X's URL is NOT doing it");
  });

  it("forbids answering an open goal with a link", () => {
    expect(SYSTEM_PROMPT).toContain("Never answer an open/play goal with just a link");
  });

  it("requires navigation even when memory has the url", () => {
    expect(SYSTEM_PROMPT).toContain("navigate there (still navigate!)");
  });

  it("does not let the have-the-answer rule excuse skipping actions", () => {
    expect(SYSTEM_PROMPT).toContain("never excuses skipping an action you have not run");
  });

  it("keeps done gated on the current page, not on knowledge", () => {
    expect(SYSTEM_PROMPT).toContain("done ONLY when the CURRENT PAGE proves it");
    expect(SYSTEM_PROMPT).toContain("If you have not navigated this turn, you are not done");
  });
});
