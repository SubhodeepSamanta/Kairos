import { parseGoal } from "../reasoning/goalUnderstanding.js";
import { askLLM } from "../llm/provider.js";

function cleanAndParseJson(text) {
  if (!text) return null;
  let cleanText = text.trim();
  const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleanText = match[1].trim();
  }
  const firstBrace = cleanText.indexOf('{');
  const firstBracket = cleanText.indexOf('[');
  const jsonStart = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? firstBrace : firstBracket;
  if (jsonStart < 0) return null;
  let lastBrace = cleanText.lastIndexOf('}');
  let lastBracket = cleanText.lastIndexOf(']');
  const jsonEnd = lastBrace >= 0 && (lastBracket < 0 || lastBrace > lastBracket) ? lastBrace + 1 : lastBracket + 1;
  if (jsonEnd <= jsonStart) return null;
  cleanText = cleanText.slice(jsonStart, jsonEnd);
  return JSON.parse(cleanText);
}

export async function evaluateState(objective, resolvedState, observation) {
  const matched = await verifyGoal(objective.objective || objective.desiredState || "", observation?.pageState || observation);
  return {
    matched,
    confidence: matched ? 0.95 : 0,
    reason: matched ? "Evidence of goal completion verified" : "Evidence of goal completion not found"
  };
}

export async function verifyObjective(objective, observation) {
  return await verifyGoal(objective.objective || objective.desiredState || "", observation?.pageState || observation);
}

export function heuristicVerifyGoal(goal, browserState, worldState = null) {
  if (!goal || !browserState) return false;
  const goalText = typeof goal === "object" ? goal.objective : goal;
  const parsedGoal = parseGoal(goalText);
  const text = (browserState.text || "").toLowerCase();
  const title = (browserState.title || "").toLowerCase();
  const url = (browserState.url || "").toLowerCase();
  const pageType = (browserState.pageType || "").toLowerCase();

  const elements = [
    ...(browserState.inputs || []),
    ...(browserState.buttons || []),
    ...(browserState.links || [])
  ];

  if (parsedGoal.objective === "extract_information") {
    if (worldState?.findings && worldState.findings.length > 0) {
      return true;
    }
    if (text.includes("data extracted success") || text.includes("[data extracted success]")) {
      return true;
    }
    if (/detail|view/i.test(pageType) || /detail|view/i.test(title) || url.includes("detail")) {
      return true;
    }
    return false;
  }

  if (parsedGoal.objective === "consume media") {
    const capabilities = browserState.capabilities || [];
    if (capabilities.includes("media_active") || capabilities.includes("media_playing") || capabilities.includes("media_available")) {
      return true;
    }
    if (pageType === "media content") {
      return true;
    }
    if (url.includes("/watch") || url.includes("/video")) {
      return true;
    }
    const semanticState = browserState.resolvedState?.semanticState || "";
    if (semanticState === "media content" || semanticState === "content detail") {
      return true;
    }
    return false;
  }

  if (parsedGoal.objective === "search_content") {
    const hasResultElements = elements.some(el => 
      el.semanticType === "primary_content" || 
      el.semanticType === "content_item" || 
      el.semanticType === "selection_candidate" ||
      el.purpose === "primary_content"
    );
    const hasResultsUrl = url.includes("/results") || url.includes("?q=") || url.includes("?query=") || url.includes("/search?");
    const hasResultsTitle = title.includes("search results") || title.includes("results for");
    if (hasResultElements || pageType === "search results" || hasResultsUrl || hasResultsTitle) {
      return true;
    }
    return false;
  }

  if (parsedGoal.objective === "authenticate") {
    if (pageType === "profile" || pageType === "dashboard" || (worldState && worldState.authenticated)) {
      return true;
    }
    if (text.includes("welcome") || text.includes("dashboard") || text.includes("my account")) {
      return true;
    }
    return false;
  }

  if (parsedGoal.objective === "retrieve artifact") {
    if (text.includes("download complete") || text.includes("exported successfully")) {
      return true;
    }
    return false;
  }

  if (parsedGoal.objective === "navigate") {
    const goalText = typeof goal === "object" ? goal.objective : goal;
    const goalLower = goalText.toLowerCase();
    const hasAdditionalAction = /search|find|play|click|type|fill|login|signin|extract|get|download|compare|open\s+and|then/.test(goalLower);
    
    if (hasAdditionalAction) {
      return false;
    }
    
    if (parsedGoal.capabilities && parsedGoal.capabilities.length > 0) {
      const capabilities = parsedGoal.capabilities.map(c => c.toLowerCase());
      for (const capability of capabilities) {
        if (url.includes(capability)) {
          return true;
        }
      }
    }
    
    if (url.startsWith("http") && !hasAdditionalAction) {
      return true;
    }
  }

  return false;
}

export async function verifyGoal(goal, browserState, worldState = null) {
  if (!goal || !browserState) return false;

  const heuristicResult = heuristicVerifyGoal(goal, browserState, worldState);
  console.log(`[VERIFY_HEURISTIC] Heuristic verification result: ${heuristicResult}`);

  if (!heuristicResult) {
    return false;
  }

  try {
    if (typeof goal === "object" && goal.metrics) {
      goal.metrics.verification_calls = (goal.metrics.verification_calls || 0) + 1;
    }
    const goalText = typeof goal === "object" ? goal.objective : goal;
    const pageTextSnippet = (browserState.text || "").slice(0, 500);
    const findingsList = worldState?.findings && worldState.findings.length > 0
      ? JSON.stringify(worldState.findings)
      : "None";

    const systemPrompt = `You are a goal verification assistant. Determine whether the user's goal has been achieved based on the current page.

DECISION CRITERIA BY GOAL TYPE:

navigate / go to / open X:
- Achieved if the page URL or title clearly matches the target
- NOT achieved if on a search page, home page, or interstitial

search for X / find X:
- Achieved if the page URL contains search parameters (?q=, ?query=, /search/) and the results match the query
- NOT achieved if on a blank page, home page, or login page

play X / watch X / listen to X:
- Achieved if on a content page with URL patterns like /watch, /video, or page is a media/video player
- NOT achieved if on a search results page or home page

extract X / get X:
- Achieved if world findings contain the requested data, or the page shows the requested information

authenticate / login:
- Achieved if page shows profile, dashboard, welcome message, or logged-in indicators

GENERAL RULES:
- A results/search page does NOT mean search is complete — check if query params match the goal
- A blank page (about:blank) means NOT achieved
- If the URL and title don't match the goal in any way, it's likely NOT achieved

Output ONLY valid JSON:
{
  "achieved": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief justification based on page evidence"
}`;

    const resolved = browserState.resolvedState || {};
    const stateLines = [];
    if (resolved.platform) stateLines.push(`Platform: ${resolved.platform}`);
    if (resolved.currentState) stateLines.push(`Current State: ${resolved.currentState}`);
    if (resolved.semanticState) stateLines.push(`Semantic State: ${resolved.semanticState}`);
    if (resolved.parameters?.query) stateLines.push(`Active Query: "${resolved.parameters.query}"`);

    const userPrompt = `Objective/Goal:
${goalText}

Current Page State:
URL: ${browserState.url || "about:blank"}
Title: ${browserState.title || "Untitled"}
Page Type/Purpose: ${browserState.pageType || browserState.pagePurpose || "generic"}
${stateLines.length > 0 ? stateLines.join("\n") + "\n" : ""}Page Text Snippet:
"""
${pageTextSnippet}
"""

World Findings:
${findingsList}

Has this goal been achieved?`;

    console.log(`[VERIFY_LLM] Calling LLM verification...`);
    const responseText = await askLLM(systemPrompt, userPrompt);
    const parsed = cleanAndParseJson(responseText);

    if (parsed && typeof parsed.achieved === "boolean" && typeof parsed.confidence === "number") {
      console.log(`[VERIFY_LLM] LLM verification response: achieved=${parsed.achieved}, confidence=${parsed.confidence}, reason="${parsed.reason}"`);
      if (parsed.achieved === true && parsed.confidence >= 0.7) {
        return true;
      }
      return false;
    }
  } catch (err) {
    console.error(`[VERIFY_LLM] LLM verification failed or returned invalid JSON:`, err.message);
  }

  console.log(`[VERIFY_LLM] Falling back to heuristic result: ${heuristicResult}`);
  return heuristicResult;
}
