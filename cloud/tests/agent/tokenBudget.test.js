import { describe, it, expect } from "vitest";
import { formatSnapshot } from "../../src/agent/snapshot.js";
import { SYSTEM_PROMPT, buildStepPrompt } from "../../src/agent/prompt.js";

const estimate = (text) => Math.ceil(text.length / 4);

function heavyPage() {
  return {
    url: "https://www.youtube.com/results?search_query=lofi",
    title: "lofi - YouTube",
    inputs: [{ id: 1, ariaRole: "searchbox", text: "Search", value: "lofi" }],
    buttons: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, text: `Button number ${i} with a fairly long label` })),
    links: Array.from({ length: 300 }, (_, i) => ({
      id: 200 + i,
      text: `Some video title number ${i} that is quite long and descriptive`,
      href: `/watch?v=${i}`
    })),
    text: "x".repeat(5000),
    tabs: [{ index: 0, title: "YouTube", active: true }]
  };
}

describe("token budget", () => {
  it("keeps a heavy page snapshot well under 1500 tokens", () => {
    const snapshot = formatSnapshot(heavyPage());
    expect(estimate(snapshot)).toBeLessThan(1500);
  });

  it("still shows every input and the true link count on a heavy page", () => {
    const snapshot = formatSnapshot(heavyPage());
    expect(snapshot).toContain('[1] searchbox "Search" value="lofi"');
    expect(snapshot).toContain("LINKS (300");
    expect(snapshot).toContain("scroll then read for more");
  });

  it("keeps a full step prompt under 2500 tokens on a heavy page", () => {
    const prompt = buildStepPrompt({
      goal: "play some lofi music on youtube",
      memories: "music: lofi\nvideo_platform: youtube",
      history: Array.from({ length: 16 }, (_, i) => `#${i} click id=${i} → ok; page did not change`),
      snapshot: formatSnapshot(heavyPage()),
      notice: ""
    });
    expect(estimate(SYSTEM_PROMPT) + estimate(prompt)).toBeLessThan(2500);
  });

  it("drops obvious nav noise before real links when over the cap", () => {
    const page = heavyPage();
    page.links = [
      ...Array.from({ length: 70 }, (_, i) => ({ id: 900 + i, text: `Real content ${i}`, href: `/c${i}` })),
      { id: 800, text: "Privacy", href: "/privacy" },
      { id: 801, text: "Terms", href: "/terms" }
    ];
    const snapshot = formatSnapshot(page);
    expect(snapshot).not.toContain('"Privacy"');
    expect(snapshot).toContain("Real content 0");
  });
});
