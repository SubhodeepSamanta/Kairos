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

export async function webSearch(query, maxResults = 8) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, { method: "POST" });
  if (!response.ok) throw new Error(`search failed: ${response.status}`);
  const html = await response.text();

  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((_, el) => {
    if (results.length >= maxResults) return false;
    const a = $(el).find("a.result__a").first();
    let href = a.attr("href") || "";
    const m = href.match(/uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    const title = a.text().trim();
    const snippet = $(el).find(".result__snippet").text().trim().slice(0, 200);
    if (title && href) results.push({ title, url: href, snippet });
  });
  return results;
}

export function formatSearchResults(results) {
  if (!results.length) return "no results";
  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`)
    .join("\n");
}

export async function fetchPageText(url, maxChars = 4000) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("html") && !contentType.includes("text") && !contentType.includes("json")) {
    throw new Error(`not a text page: ${contentType}`);
  }
  const html = await response.text();
  if (contentType.includes("json")) return html.slice(0, maxChars);

  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, iframe").remove();
  const title = $("title").text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return `${title ? `TITLE: ${title}\n` : ""}${text.slice(0, maxChars)}${text.length > maxChars ? " …" : ""}`;
}
