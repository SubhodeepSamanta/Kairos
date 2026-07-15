import { askLLM } from "../../llm/provider.js";

export async function decomposeGoal(objective, currentBrowserState = null) {
  const text = (objective || "").trim();
  if (!text) return ["navigate to destination", "verify page content"];

  let contextStr = "";
  if (currentBrowserState && currentBrowserState.url && currentBrowserState.url !== "about:blank") {
    const url = currentBrowserState.url;
    const title = currentBrowserState.title || "";
    const hostname = (() => { try { return new URL(url).hostname.replace("www.", "").split(".")[0]; } catch (e) { return ""; } })();
    contextStr = `\nCurrent page:\n- URL: ${url}\n- Title: ${title}\n- Platform: ${hostname || "unknown"}`;
    const resultsPatterns = [/\/results/, /\?q=/, /\?query=/, /\/search\//];
    const isResults = resultsPatterns.some(p => p.test(url.toLowerCase()));
    const hasResultLinks = (currentBrowserState.links || []).some(l =>
      l.purpose === "primary_content" || l.semanticType === "content_item" || l.semanticType === "selection_candidate"
    );
    if (isResults || hasResultLinks) {
      contextStr += `\n- This page CONTAINS search results`;
      try {
        const urlObj = new URL(url);
        const query = urlObj.searchParams.get("q") || urlObj.searchParams.get("query") || "";
        if (query) contextStr += ` for query: "${query}"`;
      } catch (e) {}
      contextStr += `\n- The search/query stage is ALREADY COMPLETE`;
    }
    if (currentBrowserState.title) {
      contextStr += `\n- Page title: "${currentBrowserState.title}"`;
    }
  }

  try {
    const systemPrompt = `You are a browser automation planner. Given a user's goal and the CURRENT page state, decompose the REMAINING work into sequential sub-objectives that a browser agent should complete. Each sub-objective must be a short, action-oriented phrase. Output ONLY a JSON array of strings.

EXAMPLES OF CONTEXT-AWARE DECOMPOSITION:

Goal: "search for lofi music"
Current page: about:blank (no URL)
→ ["navigate to music platform", "search for lofi music", "select a result"]

Goal: "search for lofi music"
Current page: youtube.com/search?q=lofi (already shows results)
→ ["select a result", "interact with content"]

Goal: "search for lofi music"
Current page: youtube.com (homepage with search box)
→ ["search for lofi music", "select a result", "interact with content"]

Goal: "play the first video"
Current page: youtube.com/results?q=lofi (shows results for lofi)
→ ["select first result", "play video"]

Goal: "play the first video"
Current page: youtube.com/watch?v=abc123 (already on a video page)
→ ["play video"] (just one step remaining)

CRITICAL RULES:
- NEVER include sub-objectives already satisfied by the current page.
- If current page already shows search results with the query, skip search steps.
- If current page is already on a content/video/detail page, skip selection steps.
- Keep it minimal: 1-3 objectives if most work is done.`;
    const userPrompt = `Goal: "${text}"${contextStr}\n\nDecompose the REMAINING work into sub-objectives. Current page details are provided above. Output ONLY a JSON array of strings. Keep it minimal.`;

    const responseText = await askLLM(systemPrompt, userPrompt);
    let cleaned = (responseText || "").trim();
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match) cleaned = match[1].trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(s => typeof s === "string")) {
      console.log(`[DECOMPOSE] LLM generated ${parsed.length} sub-objectives (context-aware)`);
      return parsed;
    }
  } catch (err) {
    console.error(`[DECOMPOSE] LLM decomposition failed, using fallback:`, err.message);
  }

  if (contextStr && contextStr.includes("ALREADY COMPLETE")) {
    return ["select result", "extract or interact with content", "verify completion"];
  }
  return ["navigate to destination", "locate target content", "interact with target", "verify completion"];
}
