import { generateActions, extractQueryTerm } from "./actionGenerator.js";
import { rankActions } from "./actionSelector.js";
import { buildSystemPrompt } from "../prompts/systemPrompt.js";
import { askLLM } from "../llm/provider.js";
import { rankElements } from "../agent/ranking/ranker.js";

export function cleanAndParseJson(text) {
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

export function sanitizeLlmAction(action, pageUnderstanding) {
  if (!action) return null;
  const sanitized = { type: action.type, params: {} };

  if (action.params?.element !== undefined) {
    const rawElement = action.params.element;
    const numericId = typeof rawElement === "number" ? rawElement : parseInt(String(rawElement), 10);
    if (!isNaN(numericId) && numericId > 0) {
      sanitized.params.element = numericId;
    } else {
      console.log(`[SANITIZE] Stripped invalid element ID: "${rawElement}"`);
    }
  }

  if (action.params?.text !== undefined && typeof action.params.text === "string") {
    sanitized.params.text = action.params.text.trim();
  }

  if (action.params?.url !== undefined && typeof action.params.url === "string") {
    sanitized.params.url = action.params.url.trim();
  }

  if (action.params?.direction !== undefined) {
    sanitized.params.direction = action.params.direction;
  }
  if (action.params?.amount !== undefined) {
    sanitized.params.amount = action.params.amount;
  }
  if (action.params?.key !== undefined) {
    sanitized.params.key = action.params.key;
  }

  return sanitized;
}

export function matchLlmActionToCandidate(llmAction, candidates) {
  if (!llmAction) return null;
  const type = llmAction.type;
  const elementId = llmAction.params?.element;

  let matchedCandidate = null;

  if (type === "click") {
    const c = candidates.find(c => c.type === "click" && c.elementId !== undefined && String(c.elementId) === String(elementId));
    if (c) matchedCandidate = c;
  } else if (type === "type") {
    let c = candidates.find(c => c.type === "type" && c.elementId !== undefined && String(c.elementId) === String(elementId));
    if (!c) {
      c = candidates.find(c => c.type === "search" && c.elementId !== undefined && String(c.elementId) === String(elementId));
    }
    if (c) {
      matchedCandidate = JSON.parse(JSON.stringify(c));
      if (matchedCandidate.actions[0]?.params) {
        matchedCandidate.actions[0].params.text = llmAction.params?.text || "";
      }
    }
  } else if (type === "search") {
    const c = candidates.find(c => c.type === "search" && c.elementId !== undefined && String(c.elementId) === String(elementId));
    if (c) {
      matchedCandidate = JSON.parse(JSON.stringify(c));
      if (matchedCandidate.actions[0]?.params) {
        matchedCandidate.actions[0].params.text = llmAction.params?.text || "";
      }
    }
  } else {
    const c = candidates.find(c => c.type === type);
    if (c) {
      matchedCandidate = JSON.parse(JSON.stringify(c));
      if (type === "navigate" && matchedCandidate.actions[0]?.params) {
        matchedCandidate.actions[0].params.url = llmAction.params?.url || "";
      }
    }
  }

  if (!matchedCandidate) {
    console.log(`[LLM_MATCH_MISS] LLM chose type="${type}" elementId="${elementId}" but no matching candidate was found.`);
  }

  return matchedCandidate;
}

export async function selectActionWithLLM({
  goal,
  pageUnderstanding,
  browserState,
  workflowMemory
}) {
  const candidates = generateActions(goal.objective, pageUnderstanding, browserState, goal);

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
  const contractPrompt = `OPERATING CONTRACT (you MUST follow):
1. I will use element IDs only — never put labels or text in params
2. I will re-read the page after every action that changes state
3. If my action fails twice on the same element, I will pick a different element
4. If the page doesn't change after my action, I will try something different next time
5. I will NEVER type into a search box if already on a results page with matching results
6. I will output ONLY valid JSON — no free text, no markdown, no explanations`;

  const userPrompt = `Select the single next browser action that best advances the current sub-objective.

ELEMENT REFERENCE RULES:
- Always reference elements by their numeric [id] in params. NEVER include labels, text, or names in params.
- If an element's label text is long, don't copy it — just use the ID number.
- Only choose from elements shown in the list above. Do not invent element IDs.

HOW TO MATCH SUB-OBJECTIVE TO ACTION:
- "navigate to X" / "go to X" / "open X" → navigate action, or click a link element
- "search for X" / "find X" / "search X" → use a SEARCH action (type + Enter) on an element with semanticType="search_input" or purpose="search_input". NEVER use plain type without Enter.
- "select result" / "choose result" / "open result" → click action on an element with semanticType="content_item" or purpose="primary_content"
- "scroll" / "explore" / "see more" → scroll action
- Already on a results page with an active query → search is done. If the goal was JUST to search (not "play", "watch", "select", "open result"), STOP and do NOT click results.
- Only click a result if the goal explicitly asks to play, watch, open, or select a result.
- If the last action did not change the page, do NOT repeat it.

VALID OUTPUT FORMATS (JSON only, pick ONE):

For click:
{"actions":[{"type":"click","params":{"element":3}}]}

For type+enter (search):
{"actions":[{"type":"type","params":{"element":1,"text":"search term"}},{"type":"press_key","params":{"key":"Enter"}},{"type":"read_ui","params":{}}]}

For scroll:
{"actions":[{"type":"scroll","params":{"direction":"down","amount":300}},{"type":"read_ui","params":{}}]}

For navigate:
{"actions":[{"type":"navigate","params":{"url":"https://example.com"}}]}

FAILURE MODES — NEVER DO THESE:
- Never put element labels or text in params. Only numeric IDs.
- Never output multiple actions at once that conflict (e.g., two different clicks).
- Never output free text, markdown, explanations, or code blocks. Only the JSON object.
- Never select type/search if already on a page with search results matching the query.
- Never click on video/media results unless the goal explicitly asks to play/watch/select them.
- Never use a bare type action without Enter for search inputs — always use search (type + Enter + read_ui).

${contractPrompt}`;

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

  if (!isValid) {
    try {
      goal.metrics.planning_calls = (goal.metrics.planning_calls || 0) + 1;
      console.log(`[LLM] Retrying action selection with stripped-down prompt...`);
      const retryPrompt = `Output ONLY:\n{"actions":[{"type":"TYPE","params":{"element":ID}}]}\nNo text. No labels. No markdown.`;
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
    const rawAction = parsed.actions[0];
    if (rawAction?.params?.text && (rawAction.type === "type" || rawAction.type === "search")) {
      const correctQuery = extractQueryTerm(goal.objective);
      if (correctQuery && rawAction.params.text !== correctQuery) {
        if (rawAction.params.text.length > correctQuery.length) {
          console.log(`[LLM_TEXT_FIX] Overrode LLM text "${rawAction.params.text}" → "${correctQuery}"`);
          rawAction.params.text = correctQuery;
        } else {
          console.log(`[LLM_TEXT_FIX] LLM text "${rawAction.params.text}" (shorter), keeping as-is`);
        }
      }
    }
    const cleanAction = sanitizeLlmAction(rawAction, pageUnderstanding);

    if (!cleanAction) {
      console.log(`[SANITIZE] LLM action was completely invalid after sanitization. Falling back to heuristic.`);
      parsed = null;
      isValid = false;
    }

    let matched = null;
    if (cleanAction) {
      matched = matchLlmActionToCandidate(cleanAction, candidates);
    }

    if (!matched && cleanAction) {
      const elementId = cleanAction.params?.element;
      const matchedElement = elementId !== undefined
        ? (pageUnderstanding?.importantElements || []).find(el => String(el.id) === String(elementId))
        : undefined;
      const elementExists = !!matchedElement ||
        (elementId !== undefined && (pageUnderstanding?.availableActions || []).some(a => a.endsWith(`:${elementId}`)));

      if (elementId !== undefined && !elementExists) {
        console.log(`[LLM_MATCH_MISS] LLM chose element ${elementId} which does not exist. Falling back to heuristic.`);
      } else if (elementExists && matchedElement) {
        let actionType = cleanAction.type;
        let actionParams = { ...cleanAction.params };
        if (actionType === "type" && matchedElement.actionHints?.includes("click") && !matchedElement.actionHints?.includes("type")) {
          actionType = "click";
          delete actionParams.text;
          console.log(`[LLM_CORRECTION] Converted type→click for element ${elementId} (search trigger button)`);
        }
        matched = {
          type: actionType,
          actions: [{ type: actionType, params: actionParams }, { type: "read_ui" }],
          label: `LLM ${actionType} on element ${elementId}`,
          reason: "Generated directly by LLM",
          elementId: elementId
        };
      }
    }

    if (matched) {
      const failedHistory = goal.world?.failedActionHistory || [];
      const actionType = matched.actions?.[0]?.type || "";
      const actionElement = matched.elementId || matched.actions?.[0]?.params?.element;
      const hasFailed = failedHistory.some(f => {
        const fType = f.action?.type || "";
        const fElement = f.action?.params?.element;
        return fType === actionType && fElement !== undefined && String(fElement) === String(actionElement);
      });
      if (hasFailed) {
        console.log(`[LLM_DECISION] Avoiding previously failed action: "${matched.label || matched.type}"`);
      } else {
        matched.score = matched.score || 100;
        matched.confidence = matched.confidence || 0.95;
        console.log(`[LLM_DECISION] Selected action: "${matched.label || matched.type}"`);
        return matched;
      }
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
