import { describe, it, expect } from "vitest";
import { parseFeed, formatSearchResults } from "../../src/agent/webTools.js";

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Tech News</title>
  <item><title>Chip maker ships new GPU</title><description>&lt;p&gt;It is fast and expensive.&lt;/p&gt;</description></item>
  <item><title>Startup raises $50M</title><description>Series B for an AI company.</description></item>
  <item><title>No description here</title></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Atom headline one</title><summary>Summary one.</summary></entry>
  <entry><title>Atom headline two</title><content>Content two.</content></entry>
</feed>`;

describe("parseFeed", () => {
  it("reads RSS titles and descriptions", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(3);
    expect(items[0]).toBe("Chip maker ships new GPU — It is fast and expensive.");
    expect(items[1]).toContain("Startup raises $50M");
  });

  it("strips html out of descriptions", () => {
    expect(parseFeed(RSS)[0]).not.toContain("<p>");
  });

  it("keeps titles that have no description", () => {
    expect(parseFeed(RSS)[2]).toBe("No description here");
  });

  it("reads atom entries too", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Atom headline one");
  });

  it("respects the item cap", () => {
    const many = `<rss><channel>${Array.from({ length: 40 }, (_, i) => `<item><title>Item ${i}</title></item>`).join("")}</channel></rss>`;
    expect(parseFeed(many).length).toBe(15);
  });

  it("returns nothing for non-feed xml or junk", () => {
    expect(parseFeed("<html><body>not a feed</body></html>")).toEqual([]);
    expect(parseFeed("")).toEqual([]);
  });
});

describe("formatSearchResults", () => {
  it("numbers results with urls", () => {
    const text = formatSearchResults([{ title: "GitHub", url: "https://github.com", snippet: "code" }]);
    expect(text).toContain("1. GitHub");
    expect(text).toContain("https://github.com");
  });

  it("says so when empty", () => {
    expect(formatSearchResults([])).toBe("no results");
  });
});
