import { generateActions } from "./actionGenerator.js";
import { rankActions } from "./actionSelector.js";
import { buildSystemPrompt } from "../prompts/systemPrompt.js";
import { askLLM } from "../llm/provider.js";
import { rankElements } from "../agent/ranking/ranker.js";

function cleanAndParseJson(text) {
  if (!text) return null;
  let cleanText = text.trim();
  
  // Strip markdown code blocks
  const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleanText = match[1].trim();
  }
  
  return JSON.parse(cleanText);
}

export function matchLlmActionToCandidate(llmAction, candidates) {
  if (!llmAction) return null;
  const type = llmAction.type;
  const elementId = llmAction.params?.element;

  let matchedCandidate = null;

  if (type === "click") {
    matchedCandidate = candidates.find(c => c.type === "click" && c.elementId !== undefined && String(c.elementId) === String(elementId));
  } else if (type === "type") {
    const candidate = candidates.find(c => c.type === "type" && c.elementId !== undefined && String(c.elementId) === String(elementId));
    if (candidate) {
      matchedCandidate = JSON.parse(JSON.stringify(candidate));
      if (matchedCandidate.actions[0] && matchedCandidate.actions[0].params) {
        matchedCandidate.actions[0].params.text = llmAction.params?.text || "";
      }
    }
  } else if (type === "search") {
    const candidate = candidates.find(c => c.type === "search" && c.elementId !== undefined && String(c.elementId) === String(elementId));
    if (candidate) {
      matchedCandidate = JSON.parse(JSON.stringify(candidate));
      if (matchedCandidate.actions[0] && matchedCandidate.actions[0].params) {
        matchedCandidate.actions[0].params.text = llmAction.params?.text || "";
      }
    }
  } else {
    // Scroll, back, read_ui, navigate etc.
    const candidate = candidates.find(c => c.type === type);
    if (candidate) {
      matchedCandidate = JSON.parse(JSON.stringify(candidate));
      if (type === "navigate" && matchedCandidate.actions[0] && matchedCandidate.actions[0].params) {
        matchedCandidate.actions[0].params.url = llmAction.params?.url || "";
      }
    }
  }

  if (!matchedCandidate || matchedCandidate.reason === "Generated directly by LLM") {
    console.log(`[LLM_MATCH_MISS] LLM chose type="${type}" elementId="${elementId}" but no matching candidate was found in the generated candidate list. Synthesizing a direct action — this bypasses normal candidate scoring/safety checks. If this happens often, the candidate generator is missing elements the LLM can see.`);
  }

  return matchedCandidate;
}

export async function selectActionWithLLM({
  goal,
  pageUnderstanding,
  browserState,
  workflowMemory
}) {
  const candidates = generateActions(goal.objective, pageUnderstanding, browserState);

  function rankImportantElements(goalText, elements) {
    const goalWords = (goalText || "").toLowerCase().match(/[a-z0-9]+/g) || [];
    const intent = { entities: goalWords };
    const browserShaped = {
      inputs: elements.filter(e => e.source === "inputs"),
      buttons: elements.filter(e => e.source === "buttons"),
      links: elements.filter(e => e.source === "links")
    };
    const ranked = rankElements(intent, browserShaped);
    const scoreById = new Map(ranked.map(r => [String(r.id), r.score]));
    return [...elements]
      .map(el => ({ ...el, _relevanceScore: scoreById.get(String(el.id)) || 0 }))
      .sort((a, b) => b._relevanceScore - a._relevanceScore);
  }

  const rankedElements = rankImportantElements(goal.objective, pageUnderstanding.importantElements || []);
  const elementsList = rankedElements
    .slice(0, 20)
    .map(el => {
      let label = (el.label || "").trim();
      // Truncate long labels so the LLM can't dump them back as action text
      if (label.length > 60) label = label.slice(0, 57) + "...";
      const visibility = el.inViewport === true ? "above-the-fold" : el.inViewport === false ? "requires-scroll" : "";
      const visPart = visibility ? `, visibility="${visibility}"` : "";
      return `- Element [${el.id}]: label="${label || ""}", semanticType="${el.semanticType || "none"}", purpose="${el.purpose || "none"}", role="${el.role || ""}"${visPart}`;
    })
    .join("\n");

  const resolved = pageUnderstanding.resolvedState || {};
  const browserContext = `URL: ${browserState.url || "about:blank"}
Title: ${browserState.title || "Untitled"}
Page Purpose: ${pageUnderstanding.pagePurpose || "generic"}
Platform: ${resolved.platform || "generic"}
Current State: ${resolved.currentState || "unknown"}
Semantic State: ${resolved.semanticState || "unknown"}
${resolved.parameters?.query ? `Active Query: "${resolved.parameters.query}"` : ""}
Elements (use element ID, never copy labels verbatim):
${elementsList || "No interactable elements"}`;

  const last5Actions = (goal.world?.actionHistory || [])
    .slice(-3)
    .map(entry => `${entry.action.type} ${JSON.stringify(entry.action.params || {})}`)
    .join("\n");

  const currentSubObjective = workflowMemory?.currentSubObjective || "None";

  const worldContext = `Last 5 Actions:
${last5Actions || "None"}
Sub-objective: ${currentSubObjective}`;

  const systemPrompt = buildSystemPrompt(goal, "", browserContext, worldContext);
  const userPrompt = `Select the next action. Output ONLY valid JSON with an "actions" array.

CRITICAL RULES:
- Never copy element labels into your response. Reference elements by their ID number only.
- Never output free text. Only output valid JSON.
- If an element's label contains "|", "–", or "-", do not copy it — use the element ID.
- Example: {"actions":[{"type":"click","params":{"element":3}}]}`;

  let parsed = null;
  let isValid = false;

  try {
    if (goal.metrics) {
      goal.metrics.planning_calls = (goal.metrics.planning_calls || 0) + 1;
    }

    console.log(`[LLM] Reasoning next action with LLM...`);
    const responseText = await askLLM(systemPrompt, userPrompt);
    parsed = cleanAndParseJson(responseText);

    if (parsed && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      isValid = true;
    }
  } catch (err) {
    console.error(`[LLM_ERROR] LLM selection or parsing failed:`, err.message);
  }

  // Retry once if LLM didn't produce valid JSON — with sterner prompt
  if (!isValid) {
    try {
      goal.metrics.planning_calls = (goal.metrics.planning_calls || 0) + 1;
      console.log(`[LLM] Retrying action selection with stricter prompt...`);
      const retryPrompt = `You MUST output ONLY valid JSON. No free text. No labels. No markdown. Select from the elements listed. Example: {"actions":[{"type":"click","params":{"element":3}}]}`;
      const retryText = await askLLM(systemPrompt, retryPrompt);
      const retryParsed = cleanAndParseJson(retryText);
      if (retryParsed && Array.isArray(retryParsed.actions) && retryParsed.actions.length > 0) {
        parsed = retryParsed;
        isValid = true;
        console.log(`[LLM] Retry produced valid JSON.`);
      }
    } catch (retryErr) {
      console.error(`[LLM] Retry also failed:`, retryErr.message);
    }
  }

  if (isValid && parsed) {
    let matched = matchLlmActionToCandidate(parsed.actions[0], candidates);
    if (!matched && parsed.actions[0]) {
      const llmAction = parsed.actions[0];
      matched = {
        type: llmAction.type,
        actions: [llmAction, { type: "read_ui" }],
        label: `Direct LLM ${llmAction.type}${llmAction.params?.element ? ` on element ${llmAction.params.element}` : ""}`,
        reason: "Generated directly by LLM",
        elementId: llmAction.params?.element
      };
    }

    if (matched) {
      matched.score = matched.score || 100;
      matched.confidence = matched.confidence || 0.95;
      console.log(`[LLM_DECISION] Selected action: "${matched.label || matched.type}"`);
      return matched;
    }
  }

  const ranked = rankActions(goal.objective, pageUnderstanding, candidates, goal.world?.failedActionHistory || []);
  const fallbackCandidate = ranked[0];
  if (fallbackCandidate) {
    fallbackCandidate.confidence = fallbackCandidate.confidence || 0.95;
  }
  console.log(`[HEURISTIC_FALLBACK] Selected action: "${fallbackCandidate?.label || fallbackCandidate?.type}"`);
  return fallbackCandidate;
}
