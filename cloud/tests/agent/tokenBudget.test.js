import { describe, it, expect } from "vitest";
import { formatSnapshot } from "../../src/agent/snapshot.js";
import { SYSTEM_PROMPT, DESKTOP_RULES, buildStepPrompt } from "../../src/agent/prompt.js";
import { personaBlock } from "../../src/companion/personas.js";

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

  it("keeps a full companion browser step under 3350 tokens on a heavy page", () => {
    const prompt = buildStepPrompt({
      goal: "play some lofi music on youtube",
      memories: "music: lofi\nvideo_platform: youtube",
      history: Array.from({ length: 16 }, (_, i) => `#${i} click id=${i} → ok; still on https://x.com`),
      snapshot: formatSnapshot(heavyPage()),
      notice: "",
      conversation: Array.from({ length: 14 }, (_, i) => `them: message ${i}\nyou: reply ${i}`).join("\n"),
      recentDays: "today: opened 3 leetcode problems; yesterday: github research, contest",
      mood: "latest: tired (0.7) · this week: tired x3, happy x1"
    });
    const total = estimate(SYSTEM_PROMPT) + estimate(personaBlock("aria")) + estimate(prompt);
    expect(total).toBeLessThan(3350);
  });

  it("keeps a desktop-enabled browser step under 3900 tokens", () => {
    const prompt = buildStepPrompt({
      goal: "open notepad and write a note",
      memories: "music: lofi",
      history: Array.from({ length: 16 }, (_, i) => `#${i} click id=${i} → ok`),
      snapshot: formatSnapshot(heavyPage()),
      notice: "", conversation: "", recentDays: "", mood: ""
    });
    const total = estimate(SYSTEM_PROMPT) + estimate(DESKTOP_RULES) + estimate(personaBlock("aria")) + estimate(prompt);
    expect(total).toBeLessThan(3900);
  });

  it("keeps a chat turn cheap — no page snapshot", () => {
    const prompt = buildStepPrompt({
      goal: "hey",
      memories: "music: lofi",
      history: [],
      snapshot: "BROWSER: no page loaded yet (use navigate to open one)",
      notice: "",
      conversation: "them: hey\nyou: hey! what's up?",
      recentDays: "today: played lofi",
      mood: "latest: calm (0.6)"
    });
    const total = estimate(SYSTEM_PROMPT) + estimate(personaBlock("aria")) + estimate(prompt);
    expect(total).toBeLessThan(2000);
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
