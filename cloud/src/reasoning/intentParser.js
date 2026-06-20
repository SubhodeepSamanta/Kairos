import { askLLM } from "../llm/provider.js";

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}

export async function parseIntent(goalText) {
  const text = goalText.toLowerCase().trim();

  // Regex-based fast parsing for standard patterns
  // "open youtube", "go to github"
  let match = text.match(/^(?:open|go\s+to|navigate\s+to|visit)\s+([a-z0-9.]+)(?:\.com|\.org)?$/i);
  if (match) {
    return {
      intent: "navigate",
      platform: match[1].trim()
    };
  }

  // "search github for react"
  match = text.match(/^search\s+([a-z0-9.]+)\s+for\s+(.+)$/i);
  if (match) {
    return {
      intent: "search",
      platform: match[1].trim(),
      query: match[2].trim()
    };
  }

  // "search for react on github"
  match = text.match(/^search\s+for\s+(.+?)\s+on\s+([a-z0-9.]+)$/i);
  if (match) {
    return {
      intent: "search",
      platform: match[2].trim(),
      query: match[1].trim()
    };
  }

  // "play lofi on youtube"
  match = text.match(/^play\s+(.+?)\s+on\s+([a-z0-9.]+)$/i);
  if (match && (text.includes("youtube") || text.includes("lofi") || text.includes("video"))) {
    return {
      intent: "play_video",
      platform: match[2].trim(),
      query: match[1].trim()
    };
  }

  // "find latest ai news on bing", "extract latest ai news on twitter"
  match = text.match(/^(?:find|extract|get)\s+(.+?)\s+on\s+([a-z0-9.]+)$/i);
  if (match) {
    return {
      intent: "extract_information",
      topic: match[1].trim(),
      platform: match[2].trim()
    };
  }

  // "find latest ai news", "extract latest ai news"
  match = text.match(/^(?:find|extract|get)\s+(.+)$/i);
  if (match) {
    return {
      intent: "extract_information",
      topic: match[1].trim()
    };
  }

  // Fallback to LLM
  const systemPrompt = `You are an Intent Parser. Parse the user goal into structured JSON.
Supported intents:
- "search" (fields: intent, platform, query)
- "play_video" (fields: intent, platform, query)
- "extract_information" (fields: intent, topic)
- "navigate" (fields: intent, url or platform)
- "authenticate" (fields: intent, platform)
- "generic" (fields: intent)

Return ONLY JSON.

Examples:
"search github for react" -> {"intent": "search", "platform": "github", "query": "react"}
"play lofi on youtube" -> {"intent": "play_video", "platform": "youtube", "query": "lofi"}
"find latest AI news" -> {"intent": "extract_information", "topic": "AI news"}
`;

  try {
    const response = await askLLM(systemPrompt, goalText);
    return JSON.parse(extractJson(response));
  } catch (err) {
    console.error("[intentParser] Fallback failed:", err);
    return {
      intent: "generic",
      originalGoal: goalText
    };
  }
}
