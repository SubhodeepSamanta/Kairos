import * as cheerio from "cheerio";

const FETCH_TIMEOUT = 15000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, {
      ...options,
      headers: { "User-Agent": UA, ...(options.headers || {}) },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export function parseDuckDuckGoHtml(html, maxResults = 8) {
  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((_, el) => {
    if (results.length >= maxResults) return false;
    if ($(el).is(".result--ad, .result--ad-v2")) return;
    const a = $(el).find("a.result__a").first();
    let href = a.attr("href") || "";
    if (!href || href.includes("/y.js") || /[?&]ad_(provider|domain|type)=/.test(href)) return;
    const m = href.match(/uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    if (/^(https?:)?\/\/(duckduckgo\.com|duck\.co)\//i.test(href)) return;
    const title = a.text().trim();
    const snippet = $(el).find(".result__snippet").text().trim().slice(0, 200);
    if (title && href) results.push({ title, url: href, snippet });
  });
  return results;
}

async function searchDuckDuckGo(query, maxResults) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, { method: "POST" });
  if (!response.ok) return [];
  return parseDuckDuckGoHtml(await response.text(), maxResults);
}

function unwrapBingUrl(href) {
  const m = href.match(/[?&]u=a1([^&]+)/);
  if (!m) return href;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return href;
  }
}

async function searchBing(query, maxResults) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, { headers: { "Accept-Language": "en-US,en;q=0.9" } });
  if (!response.ok) return [];
  const html = await response.text();

  const $ = cheerio.load(html);
  const results = [];
  $("li.b_algo").each((_, el) => {
    if (results.length >= maxResults) return false;
    const a = $(el).find("h2 a").first();
    const href = a.attr("href");
    const title = a.text().trim();
    const snippet = $(el).find(".b_caption p").text().trim().slice(0, 200);
    if (title && href) results.push({ title, url: unwrapBingUrl(href), snippet });
  });
  return results;
}

export async function webSearch(query, maxResults = 8) {
  let results = await searchDuckDuckGo(query, maxResults).catch(() => []);
  if (!results.length) {
    results = await searchBing(query, maxResults).catch(() => []);
  }
  if (!results.length) {
    throw new Error("search engines are blocking us right now — open the browser, navigate to https://www.bing.com/search?q=… and read the page instead");
  }
  return results;
}

export function formatSearchResults(results) {
  if (!results.length) return "no results";
  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`)
    .join("\n");
}

const THIN_PAGE_CHARS = 600;

export function parseFeed(xml, maxItems = 15) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $("item, entry").each((_, el) => {
    if (items.length >= maxItems) return false;
    const node = $(el);
    const title = node.find("title").first().text().trim();
    if (!title) return;
    const summary = node.find("description, summary, content").first().text()
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
    items.push(summary ? `${title} — ${summary}` : title);
  });

  return items;
}

function findFeedUrl($, pageUrl) {
  const href = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first().attr("href");
  if (!href) return null;
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return null;
  }
}

export async function fetchPageText(url, maxChars = 4000) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("html") && !contentType.includes("text") && !contentType.includes("json") && !contentType.includes("xml")) {
    throw new Error(`not a text page: ${contentType}`);
  }
  const body = await response.text();
  if (contentType.includes("json")) return body.slice(0, maxChars);

  if (contentType.includes("xml") || /^\s*<(\?xml|rss|feed)/i.test(body)) {
    const items = parseFeed(body);
    if (items.length) return `FEED ${url}\n${items.join("\n")}`.slice(0, maxChars);
  }

  const $ = cheerio.load(body);
  const feedUrl = findFeedUrl($, url);

  $("script, style, noscript, svg, nav, footer, iframe, header, aside").remove();
  const title = $("title").text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  if (text.length < THIN_PAGE_CHARS && feedUrl) {
    try {
      const feedRes = await fetchWithTimeout(feedUrl);
      if (feedRes.ok) {
        const items = parseFeed(await feedRes.text());
        if (items.length) {
          console.log(`[FETCH] ${url} was thin (${text.length} chars) — used its RSS feed instead`);
          return `FEED ${feedUrl}\n${items.join("\n")}`.slice(0, maxChars);
        }
      }
    } catch {}
  }

  if (!text.length) {
    throw new Error("page rendered no readable text (likely JS-only) — try a different url, or open it in the browser and read");
  }

  return `${title ? `TITLE: ${title}\n` : ""}${text.slice(0, maxChars)}${text.length > maxChars ? " …" : ""}`;
}
