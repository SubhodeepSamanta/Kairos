import { parseGoal } from "../reasoning/goalUnderstanding.js";
import { askLLM } from "../llm/provider.js";

function cleanAndParseJson(text) {
  if (!text) return null;
  let cleanText = text.trim();
  const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleanText = match[1].trim();
  }
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

  // 1. Data extraction verification
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

  // 2. Consume media verification
  if (parsedGoal.objective === "consume media") {
    const capabilities = browserState.capabilities || [];
    if (capabilities.includes("media_active") || capabilities.includes("media_playing") || capabilities.includes("media_available")) {
      return true;
    }
    if (pageType === "media content") {
      return true;
    }
    return false;
  }

  // 3. Search verification
  if (parsedGoal.objective === "search_content") {
    const hasResultElements = elements.some(el => 
      el.semanticType === "primary_content" || 
      el.semanticType === "content_item" || 
      el.semanticType === "selection_candidate" ||
      el.purpose === "primary_content"
    );
    if (hasResultElements || pageType === "search results") {
      return true;
    }
    return false;
  }

  // 4. Authenticate verification
  if (parsedGoal.objective === "authenticate") {
    if (pageType === "profile" || pageType === "dashboard" || (worldState && worldState.authenticated)) {
      return true;
    }
    if (text.includes("welcome") || text.includes("dashboard") || text.includes("my account")) {
      return true;
    }
    return false;
  }

  // 5. Retrieve artifact verification
  if (parsedGoal.objective === "retrieve artifact") {
    if (text.includes("download complete") || text.includes("exported successfully")) {
      return true;
    }
    return false;
  }

  // 6. Navigation verification  
  if (parsedGoal.objective === "navigate") {
    // Only verify as complete if we landed on the exact platform mentioned
    // AND the goal doesn't mention any additional actions to perform
    const goalText = typeof goal === "object" ? goal.objective : goal;
    const goalLower = goalText.toLowerCase();
    const hasAdditionalAction = /search|find|play|click|type|fill|login|signin|extract|get|download|compare|open\s+and|then/.test(goalLower);
    
    if (hasAdditionalAction) {
      // Multi-step goal - don't verify navigation as complete
      return false;
    }
    
    if (parsedGoal.platform && url.includes(parsedGoal.platform)) {
      return true;
    }
    // Only verify if we're on a non-blank page AND goal was purely navigational
    if (url.startsWith("http") && !hasAdditionalAction) {
      return true;
    }
  }

  return false;
}

export async function verifyGoal(goal, browserState, worldState = null) {
  if (!goal || !browserState) return false;

  // 1. Keep the fast heuristic check as a FIRST PASS
  const heuristicResult = heuristicVerifyGoal(goal, browserState, worldState);
  console.log(`[VERIFY_HEURISTIC] Heuristic verification result: ${heuristicResult}`);

  // 2. If heuristic returns TRUE, run a second LLM verification call to confirm
  if (!heuristicResult) {
    return false;
  }

  // 3. LLM verification call
  try {
    if (typeof goal === "object" && goal.metrics) {
      goal.metrics.verification_calls = (goal.metrics.verification_calls || 0) + 1;
    }
    const goalText = typeof goal === "object" ? goal.objective : goal;
    const pageTextSnippet = (browserState.text || "").slice(0, 500);
    const findingsList = worldState?.findings && worldState.findings.length > 0
      ? JSON.stringify(worldState.findings)
      : "None";

    const systemPrompt = `You are a goal verification assistant.
Your task is to determine whether the user's objective/goal has been fully achieved based on the current page state and world findings.

Answer ONLY with a valid JSON object matching this schema:
{
  "achieved": true/false,
  "confidence": 0-1 (a decimal number between 0 and 1),
  "reason": "a brief explanation of your decision"
}`;

    const userPrompt = `Objective/Goal:
${goalText}

Current Page State:
URL: ${browserState.url || "about:blank"}
Title: ${browserState.title || "Untitled"}
Page Type/Purpose: ${browserState.pageType || browserState.pagePurpose || "generic"}
Page Text Snippet:
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

  // 5. Fallback to heuristic result if LLM fails or is unavailable
  console.log(`[VERIFY_LLM] Falling back to heuristic result: ${heuristicResult}`);
  return heuristicResult;
}
