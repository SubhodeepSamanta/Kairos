import { askLLM } from "../llm/provider.js";

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}

export async function parseIntent(
  goalText,
  browserContext = {}
) {
  const text = goalText.toLowerCase().trim();

  // Fast page-action detection for ordinals
  let match = text.match(
    /^(?:play|watch|open|click|select|go\s+to|visit)\s+(first|second|third|fourth|fifth|latest)\s+(repository|result|product|article|video|internship|link|item)s?$/i
  );

  if (match) {
    return {
      intent: "page_action",
      useCurrentPage: true,
      ordinal: match[1].toLowerCase(),
      targetType: match[2].toLowerCase(),
      originalGoal: goalText
    };
  }

  // Regex-based fast parsing for standard patterns
  // "open youtube", "go to github"
  match = text.match(/^(?:open|go\s+to|navigate\s+to|visit)\s+([a-z0-9.]+)(?:\.com|\.org)?$/i);
  if (match) {
    return {
      intent: "navigate",
      platform: match[1].trim()
    };
  }

  match = text.match(/^(?:login|sign\s+in|authenticate)(?:\s+to|\s+on)?\s+([a-z0-9.]+)(?:\.com|\.org)?$/i);
  if (match) {
    return {
      intent: "authenticate",
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
- "page_action" (fields: intent, useCurrentPage, ordinal, targetType)
- "generic" (fields: intent)

Return ONLY JSON.

Examples:
"search github for react" -> {"intent": "search", "platform": "github", "query": "react"}
"play lofi on youtube" -> {"intent": "play_video", "platform": "youtube", "query": "lofi"}
"find latest AI news" -> {"intent": "extract_information", "topic": "AI news"}
"open first repository" -> {"intent": "page_action", "useCurrentPage": true, "ordinal": "first", "targetType": "repository"}
"play first video" -> {"intent": "page_action", "useCurrentPage": true, "ordinal": "first", "targetType": "video"}
`;

  try {
    const response = await askLLM(systemPrompt, goalText);
    const parsedIntent = JSON.parse(extractJson(response));
    if (
      parsedIntent.intent === "search" &&
      !parsedIntent.platform &&
      browserContext.currentPlatform
    ) {
      parsedIntent.platform =
        browserContext.currentPlatform;
    }
    return parsedIntent;
  } catch (err) {
    console.error("[intentParser] Fallback failed:", err);
    return {
      intent: "generic",
      originalGoal: goalText
    };
  }
}
