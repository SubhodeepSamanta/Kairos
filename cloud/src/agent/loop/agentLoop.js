import { createPlan } from "../../shared/schemas/plan.js";
import { llmCallCount, resetLlmCallCount, askLLM } from "../../llm/provider.js";
import { updateWorldModel, addFinding } from "../../world/worldModel.js";
import { extractDataFromPage } from "../../reasoning/extractor.js";
import { understandPage } from "../../world/pageUnderstandingV2.js";
import { initTracker } from "../../reasoning/objectiveTracker.js";
import { verifyGoal } from "../../verification/objectiveVerifier.js";
import { createExecutionContext, generateExecutionSummary } from "../../world/executionContext.js";
import { loadAgentSession, saveAgentSession, checkForHumanIntervention } from "../state/agentSession.js";
import { selectActionWithLLM } from "../../reasoning/llmActionSelector.js";
import { determineRecovery } from "../recovery/recovery.js";
import { WorkflowMemory } from "../../memory/workflowMemory.js";
import humanLoopBus from "../../humanLoop/humanLoopBus.js";

function printMetrics(goal, startTime, startLlmCalls) {
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const llmCallsUsed = llmCallCount - startLlmCalls;
  const metrics = goal.metrics || { skillExecutions: 0, fallbackCount: 0, plannerPromptChars: 0, compressedPromptChars: 0, totalActions: 0, intent_calls: 0, planning_calls: 0, verification_calls: 0 };
  
  console.log(`
===== EXECUTION METRICS =====

Goal:
${goal.objective}

LLM Calls: ${llmCallsUsed}
  - intent_calls: ${metrics.intent_calls || 0}
  - planning_calls: ${metrics.planning_calls || 0}
  - verification_calls: ${metrics.verification_calls || 0}

Actions: ${metrics.totalActions || 0}
Skill Executions: ${metrics.skillExecutions}
Fallbacks: ${metrics.fallbackCount}

Duration: ${durationSec}s
===========================
`);
  
}

async function decomposeGoal(objective, currentBrowserState = null) {
  const text = (objective || "").trim();
  if (!text) return ["navigate to destination", "verify page content"];

  let contextStr = "";
  if (currentBrowserState && currentBrowserState.url && currentBrowserState.url !== "about:blank") {
    const url = currentBrowserState.url;
    const title = currentBrowserState.title || "";
    const hostname = (() => { try { return new URL(url).hostname.replace("www.", "").split(".")[0]; } catch (e) { return ""; } })();
    contextStr = `\nCurrent page:\n- URL: ${url}\n- Title: ${title}\n- Platform: ${hostname || "unknown"}`;
    const resultsPatterns = [/\/results/, /\?search_query=/, /\?q=/, /\?query=/, /\/search\//];
    const isResults = resultsPatterns.some(p => p.test(url.toLowerCase()));
    const hasResultLinks = (currentBrowserState.links || []).some(l =>
      l.purpose === "primary_content" || l.semanticType === "content_item" || l.semanticType === "selection_candidate"
    );
    if (isResults || hasResultLinks) {
      contextStr += `\n- This page CONTAINS search results`;
      try {
        const urlObj = new URL(url);
        const query = urlObj.searchParams.get("search_query") || urlObj.searchParams.get("q") || urlObj.searchParams.get("query") || "";
        if (query) contextStr += ` for query: "${query}"`;
      } catch (e) {}
      contextStr += `\n- The search/query stage is ALREADY COMPLETE`;
    }
    if (currentBrowserState.title) {
      contextStr += `\n- Page title: "${currentBrowserState.title}"`;
    }
  }

  try {
    const systemPrompt = `You are a browser automation planner. Given a user's goal and the CURRENT page state, decompose the REMAINING work into 1-5 sequential sub-objectives that a browser agent should complete. Each sub-objective should be a short, action-oriented phrase. Output ONLY a JSON array of strings. Example: ["navigate to site", "search for content", "select result", "extract information"]`;
    const userPrompt = `Goal: "${text}"${contextStr}\n\nDecompose the REMAINING work into sub-objectives. CRITICAL: Only include sub-objectives that are NOT already satisfied by the current page state. If the current page already shows search results, do NOT include search-related sub-objectives - start from result selection. Output ONLY a JSON array of strings. Keep it minimal (1-3 objectives if most work is done).`;

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

  // Context-aware fallback
  if (contextStr && contextStr.includes("ALREADY COMPLETE")) {
    return ["select result", "extract or interact with content", "verify completion"];
  }
  return ["navigate to destination", "locate target content", "interact with target", "verify completion"];
}

function estimateProgress(workflowMemory, browserState) {
  if (!workflowMemory || !workflowMemory.subObjectives) {
    return { percent: 50, stage: "executing workflow" };
  }
  const total = workflowMemory.subObjectives.length;
  if (total === 0) return { percent: 0, stage: "not started" };

  const currentIdx = workflowMemory.subObjectives.indexOf(workflowMemory.currentSubObjective);
  const completedCount = currentIdx >= 0 ? currentIdx : 0;
  
  let percent = Math.round((completedCount / total) * 100);

  if (browserState && browserState.url && browserState.url !== "about:blank") {
    percent = Math.max(percent, 20);
  }

  return {
    percent: Math.min(95, percent),
    stage: workflowMemory.currentSubObjective || "processing",
    completed: workflowMemory.subObjectives.slice(0, completedCount),
    remaining: workflowMemory.subObjectives.slice(completedCount)
  };
}

function updateSubObjectives(workflowMemory, browserState, pageUnderstanding) {
  const subObjectives = workflowMemory.subObjectives || [];
  const currentIdx = subObjectives.indexOf(workflowMemory.currentSubObjective);
  if (currentIdx === -1) return;

  const resolvedState = pageUnderstanding?.resolvedState || {};
  const currentState = resolvedState.currentState || "";
  const purpose = (pageUnderstanding?.pagePurpose || "").toLowerCase();
  const url = (browserState.url || "").toLowerCase();

  const hasRealPage = url && url !== "about:blank";

  function currentSubObjectiveMatches(...keywords) {
    const sub = (workflowMemory.currentSubObjective || "").toLowerCase();
    return keywords.some(k => sub.includes(k));
  }

  const isOnResultsPage = currentState === "results" || /result|search/.test(purpose);
  const isOnContentPage = currentState === "content" || /content|detail|media|article|product|profile/.test(purpose);

  // Check if current sub-objective is already satisfied by page state
  // If it's a search objective and we're on results, mark it complete
  const currentIsSearch = currentSubObjectiveMatches("search", "query", "find", "locate");
  const currentIsNavigation = currentSubObjectiveMatches("navigate", "go to", "open", "launch", "destination");
  const currentIsSelect = currentSubObjectiveMatches("select", "choose", "pick", "click", "open result");

  let satisfied = false;
  if (currentIsSearch && isOnResultsPage) satisfied = true;
  if (currentIsNavigation && hasRealPage) satisfied = true;
  if (currentIsSelect && isOnContentPage) satisfied = true;

  // If current sub-objective is satisfied, advance or mark completion
  if (satisfied) {
    workflowMemory.completedSubObjectives.push(workflowMemory.currentSubObjective);
    const nextIdx = currentIdx + 1;
    if (nextIdx < subObjectives.length) {
      workflowMemory.currentSubObjective = subObjectives[nextIdx];
      console.log(`[SUB-OBJECTIVE] Advanced to: "${workflowMemory.currentSubObjective}" (satisfied by page state)`);
    } else {
      workflowMemory.currentSubObjective = "";
      console.log(`[SUB-OBJECTIVE] All sub-objectives completed (last one satisfied by page state)`);
    }
    return;
  }

  if (currentIdx >= subObjectives.length - 1) return;

  // --- Direct state-based advancement (skip ahead when past certain stages) ---
  if (isOnResultsPage) {
    if (currentSubObjectiveMatches("navigate", "destination", "search for", "locate", "find")) {
      let targetIdx = currentIdx;
      while (targetIdx < subObjectives.length) {
        const sobj = subObjectives[targetIdx].toLowerCase();
        if (sobj.includes("select") || sobj.includes("result") || sobj.includes("click") || sobj.includes("open") || sobj.includes("extract") || sobj.includes("interact") || sobj.includes("verify") || sobj.includes("content")) {
          break;
        }
        targetIdx++;
      }
      if (targetIdx > currentIdx) {
        for (let i = currentIdx; i < targetIdx; i++) {
          workflowMemory.completedSubObjectives.push(subObjectives[i]);
        }
        workflowMemory.currentSubObjective = subObjectives[targetIdx];
        console.log(`[SUB-OBJECTIVE] Skipped to: "${workflowMemory.currentSubObjective}" (already on results page)`);
        return;
      }
    }
  }

  if (isOnContentPage && currentSubObjectiveMatches("select result", "click result", "choose result")) {
    let targetIdx = currentIdx + 1;
    if (targetIdx < subObjectives.length) {
      workflowMemory.completedSubObjectives.push(workflowMemory.currentSubObjective);
      workflowMemory.currentSubObjective = subObjectives[targetIdx];
      console.log(`[SUB-OBJECTIVE] Skipped to: "${workflowMemory.currentSubObjective}" (already on content page)`);
      return;
    }
  }

  // --- Fallback heuristic advancement (conservative) ---
  const purposeIsSpecific = purpose && purpose !== "generic" && purpose !== "landing_page";
  const isResultsPageHeuristic = /result|search/.test(purpose) || url.includes("/results") || url.includes("?search_query=") || url.includes("?q=");
  const isContentPageHeuristic = /content|detail|media|article|product|profile/.test(purpose) || url.includes("/watch");
  const isFormPage = /form|login|auth/.test(purpose);

  let advance = false;
  const progressPercent = currentIdx / Math.max(subObjectives.length - 1, 1);

  // Only advance if page purpose clearly indicates forward progress
  if (progressPercent < 0.25 && hasRealPage && purposeIsSpecific) {
    advance = true;
  } else if (progressPercent < 0.5 && (isResultsPageHeuristic || purposeIsSpecific)) {
    advance = true;
  } else if (progressPercent < 0.75 && isContentPageHeuristic) {
    advance = true;
  } else if (progressPercent >= 0.75 && (isContentPageHeuristic || isFormPage)) {
    advance = true;
  }

  if (advance) {
    workflowMemory.completedSubObjectives.push(workflowMemory.currentSubObjective);
    workflowMemory.currentSubObjective = subObjectives[currentIdx + 1];
    console.log(`[SUB-OBJECTIVE] Advanced to: "${workflowMemory.currentSubObjective}"`);
  }
}

export async function runAgent({
    goal,
    executePlan
}) {
  resetLlmCallCount();
  const startTime = Date.now();
  const startLlmCalls = llmCallCount;
  goal.metrics = { 
    skillExecutions: 0, 
    fallbackCount: 0, 
    plannerPromptChars: 0, 
    compressedPromptChars: 0, 
    totalActions: 0,
    intent_calls: 0,
    planning_calls: 0,
    verification_calls: 0
  };

  const wrapExecutePlan = async (plan) => {
    if (plan && plan.actions) {
      goal.metrics.totalActions += plan.actions.length;
    }
    try {
      return await executePlan(plan);
    } catch (err) {
      if (err.message === "No connected client") {
        console.error("[AGENT] Client disconnected during execution. Stopping agent.");
        return { observations: [], clientDisconnected: true };
      }
      throw err;
    }
  };

  try {
    const res = await _runAgentInternal({ goal, executePlan: wrapExecutePlan });
    printMetrics(goal, startTime, startLlmCalls);
    return res;
  } catch (err) {
    console.error(`[AGENT FATAL ERROR] Goal "${goal.objective}" crashed with:`, err.message);
    console.error(err.stack);
    printMetrics(goal, startTime, startLlmCalls);
    throw err;
  }
}

function extractBrowserState(obs) {
  if (!obs) return {};
  // If obs has pageState nested, use that; otherwise use obs itself
  const state = obs?.pageState || obs || {};
  // Ensure common fields exist at top level
  return {
    url: state.url || obs.url || "",
    title: state.title || obs.title || "",
    text: state.text || obs.text || "",
    inputs: state.inputs || obs.inputs || [],
    buttons: state.buttons || obs.buttons || [],
    links: state.links || obs.links || [],
    pageType: state.pageType || obs.pageType || "",
    capabilities: state.capabilities || obs.capabilities || [],
    tabs: state.tabs || obs.tabs || [],
    activeTab: state.activeTab || obs.activeTab || null,
    pagePurpose: state.pagePurpose || obs.pagePurpose || "",
    ...state
  };
}

function detectActionLoop(world) {
  if (!world) return false;
  const history = world.actionHistory || [];
  if (history.length < 4) return false;
  const last4 = history.slice(-4).map(h => {
    const a = h.action;
    return `${a.type}:${a.params?.element || ""}:${a.params?.url || ""}:${a.params?.text || ""}`;
  });
  if (last4[2] === last4[0] && last4[3] === last4[1] && last4[0] === last4[2]) {
    return true;
  }
  if (last4[1] === last4[2] && last4[2] === last4[3]) {
    return true;
  }
  return false;
}

async function _runAgentInternal({
    goal,
    executePlan
}) {
  const MAX_GOAL_ACTIONS = 30;
  const initReadPlan = {
    goalId: goal.id,
    actions: [{ type: "read_ui", params: {} }]
  };
  console.log("[AGENT] Fetching initial page state...");
  const initResult = await executePlan(initReadPlan);
  const initObs = initResult?.observations?.[initResult.observations.length - 1];
  if (initObs) {
    updateWorldModel(goal, initObs);
    goal.metrics.totalActions = 0;
  }

  let latestObs = initObs || goal.world?.history?.[goal.world.history.length - 1]?.observation;
  let browserState = extractBrowserState(latestObs);

  const savedSession = loadAgentSession(goal.id);
  let context;
  let workflowMemory;
  if (savedSession) {
    console.log(`[AGENT] Resuming workflow from saved state: ${savedSession.stateType}`);
    context = savedSession.context;
    goal.tracker = savedSession.tracker;
    workflowMemory = Object.assign(new WorkflowMemory(), savedSession.workflowMemory);
    if (savedSession.findings && goal.world) {
      goal.world.findings = savedSession.findings;
    }
  } else {
    context = createExecutionContext(goal);
    goal.tracker = initTracker([{ desiredState: "goal_completed", objective: goal.objective }]);
    workflowMemory = new WorkflowMemory();

    const subObjectives = await decomposeGoal(goal.objective, browserState);
    workflowMemory.currentObjective = goal.objective;
    workflowMemory.currentSubObjective = subObjectives[0] || goal.objective;
    workflowMemory.subObjectives = subObjectives;
    workflowMemory.completedSubObjectives = [];
  }
  goal.context = context;
  goal.workflowMemory = workflowMemory;

  const intentCheck = workflowMemory.handleWorkflowIntents(goal.objective);
  if (intentCheck) {
    console.log(`[WORKFLOW INTENT] Intercepted memory directive: ${intentCheck.action}`);
    if (intentCheck.action === "close_tab") {
      const closePlan = {
        goalId: goal.id,
        actions: [{ type: "close_tab", params: {} }]
      };
      await executePlan(closePlan);
    } else if (intentCheck.action === "navigate" && intentCheck.url) {
      const navPlan = {
        goalId: goal.id,
        actions: [{ type: "navigate", params: { url: intentCheck.url } }]
      };
      await executePlan(navPlan);
    }
  }

  const initIntervention = checkForHumanIntervention(browserState, null, null);
  if (initIntervention && initIntervention.interventionNeeded) {
    console.log(`[HUMAN INPUT REQUIRED] ${initIntervention.reason}`);
    const summary = generateExecutionSummary(context, goal.tracker);
    saveAgentSession(goal, goal.tracker, context, initIntervention.state, null, workflowMemory);
    humanLoopBus.emit("intervention_needed", {
      goalId: goal.id,
      reason: initIntervention.reason,
      state: initIntervention.state,
      pageUrl: browserState.url || "",
      pageTitle: browserState.title || ""
    });
    return {
      success: false,
      reason: initIntervention.state,
      requiresHumanInput: true,
      observation: latestObs,
      contextSummary: summary
    };
  }

  if (await verifyGoal(goal, browserState, goal.world)) {
    console.log(`[GOAL COMPLETE] Initial browser state already satisfies the goal.`);
    const summary = generateExecutionSummary(context, goal.tracker);
    return {
      success: true,
      confidence: 1.0,
      observation: latestObs,
      contextSummary: summary
    };
  }

  let retryCount = 0;
  let lastAction = null;

  while (goal.metrics.totalActions < MAX_GOAL_ACTIONS) {
    let result = null;

    if (detectActionLoop(goal.world)) {
      console.log("[LOOP DETECTION] Agent appears stuck.");
      retryCount++;

      if (retryCount <= 2) {
        // First attempts: scroll and re-read
        console.log("[LOOP DETECTION] Attempting scroll+read recovery.");
        const unstickPlan = createPlan(goal.id, [
          { type: "scroll", params: { direction: "down", amount: 500 } },
          { type: "read_ui", params: {} }
        ]);
        const unstickResult = await executePlan(unstickPlan);
        latestObs = unstickResult?.observations?.[unstickResult.observations.length - 1] || latestObs;
        browserState = extractBrowserState(latestObs);
        updateWorldModel(goal, latestObs);
      } else {
        // Stuck after retries: replan from current page state
        console.log("[LOOP DETECTION] Scroll didn't help. Replanning from current context.");
        const pageUnderstanding = understandPage(browserState);
        const newObjectives = await decomposeGoal(goal.objective, browserState);
        if (newObjectives && newObjectives.length > 0) {
          workflowMemory.subObjectives = newObjectives;
          workflowMemory.currentSubObjective = newObjectives[0];
          workflowMemory.completedSubObjectives = [];
          console.log(`[LOOP DETECTION] Replanned to: ${JSON.stringify(newObjectives)}`);
        }
        // Also apply page understanding for this iteration
        const bestCandidate = await selectActionWithLLM({
          goal,
          pageUnderstanding,
          browserState,
          workflowMemory
        });
        if (bestCandidate && bestCandidate.actions && bestCandidate.actions.length > 0) {
          const plan = createPlan(goal.id, bestCandidate.actions);
          const result = await executePlan(plan);
          if (result?.clientDisconnected) {
            return {
              success: false,
              reason: "client_disconnected",
              observation: latestObs,
              contextSummary: generateExecutionSummary(context, goal.tracker)
            };
          }
          latestObs = result?.observations?.[result.observations.length - 1] || latestObs;
          browserState = extractBrowserState(latestObs);
          lastAction = bestCandidate.actions[0];
          updateWorldModel(goal, latestObs);
        }
      }

      if (retryCount > 5) {
        return {
          success: false,
          reason: "agent_stuck_in_loop",
          observation: latestObs,
          contextSummary: generateExecutionSummary(context, goal.tracker)
        };
      }
      continue;
    }

    const pageUnderstanding = understandPage(browserState);

    updateSubObjectives(workflowMemory, browserState, pageUnderstanding);
    const progress = estimateProgress(workflowMemory, browserState);
    console.log(`[PROGRESS] ${progress.percent}% - ${progress.stage}`);

    const bestCandidate = await selectActionWithLLM({
      goal,
      pageUnderstanding,
      browserState,
      workflowMemory
    });

    const loopIntervention = checkForHumanIntervention(browserState, pageUnderstanding, bestCandidate);
    if (loopIntervention && loopIntervention.interventionNeeded) {
      console.log(`[HUMAN INPUT REQUIRED] ${loopIntervention.reason}`);
      const summary = generateExecutionSummary(context, goal.tracker);
      saveAgentSession(goal, goal.tracker, context, loopIntervention.state, null, workflowMemory);
      humanLoopBus.emit("intervention_needed", {
        goalId: goal.id,
        reason: loopIntervention.reason,
        state: loopIntervention.state,
        pageUrl: browserState.url || "",
        pageTitle: browserState.title || ""
      });
      return {
        success: false,
        reason: loopIntervention.state,
        requiresHumanInput: true,
        observation: latestObs,
        contextSummary: summary
      };
    }

    if (!bestCandidate || !bestCandidate.actions || bestCandidate.actions.length === 0) {
      console.log(`[AGENT] No action candidate selected. Running recovery.`);
      const recoveryActions = determineRecovery(lastAction, browserState, null, retryCount);

      if (recoveryActions && recoveryActions.escalate) {
        console.log(`[RECOVERY ESCALATION] Escalating to: ${recoveryActions.state}`);
        const summary = generateExecutionSummary(context, goal.tracker);
        saveAgentSession(goal, goal.tracker, context, recoveryActions.state, null, workflowMemory);
        return {
          success: false,
          reason: recoveryActions.state,
          observation: latestObs,
          contextSummary: summary
        };
      }

      console.log(`[RECOVERY] Executing recovery actions.`);
      const recPlan = createPlan(goal.id, recoveryActions);
      const recResult = await executePlan(recPlan);
      if (recResult?.clientDisconnected) {
        return {
          success: false,
          reason: "client_disconnected",
          observation: latestObs,
          contextSummary: generateExecutionSummary(context, goal.tracker)
        };
      }
      latestObs = recResult?.observations?.[recResult.observations.length - 1] || latestObs;
      browserState = extractBrowserState(latestObs);
      updateWorldModel(goal, latestObs);
      retryCount++;
      continue;
    }

    console.log(`[AGENT] Executing action: "${bestCandidate.label}"`);

    const plan = createPlan(goal.id, bestCandidate.actions);
    result = await executePlan(plan);

    if (result?.clientDisconnected) {
      return {
        success: false,
        reason: "client_disconnected",
        observation: latestObs,
        contextSummary: generateExecutionSummary(context, goal.tracker)
      };
    }

    latestObs = result?.observations?.[result.observations.length - 1] || latestObs;
    browserState = extractBrowserState(latestObs);

    const postIntervention = checkForHumanIntervention(browserState, pageUnderstanding, bestCandidate);
    if (postIntervention && postIntervention.interventionNeeded) {
      console.log(`[HUMAN INPUT REQUIRED] ${postIntervention.reason}`);
      const summary = generateExecutionSummary(context, goal.tracker);
      saveAgentSession(goal, goal.tracker, context, postIntervention.state, null, workflowMemory);
      humanLoopBus.emit("intervention_needed", {
        goalId: goal.id,
        reason: postIntervention.reason,
        state: postIntervention.state,
        pageUrl: browserState.url || "",
        pageTitle: browserState.title || ""
      });
      return {
        success: false,
        reason: postIntervention.state,
        requiresHumanInput: true,
        observation: latestObs,
        contextSummary: summary
      };
    }

    lastAction = bestCandidate.actions[0];
    updateWorldModel(goal, latestObs);

    if (bestCandidate.type === "extract" && latestObs?.success) {
      const pageText = browserState.text || "";
      const cleanQuery = bestCandidate.actions[0]?.params?.query || goal.objective;
      console.log(`[EXTRACT] Extracting data for query: "${cleanQuery}"...`);
      const extractedData = await extractDataFromPage(pageText, cleanQuery);
      addFinding(goal, {
        query: cleanQuery,
        data: extractedData,
        source: { url: browserState.url || "", title: browserState.title || "" }
      });
      console.log(`[EXTRACT] Finding added to world model:`, JSON.stringify(extractedData));
    }

    // Enrich browserState with page understanding for richer goal verification
    const verifyState = {
      ...browserState,
      pagePurpose: pageUnderstanding?.pagePurpose || browserState.pagePurpose || "",
      resolvedState: pageUnderstanding?.resolvedState || null
    };

    if (await verifyGoal(goal, verifyState, goal.world)) {
      console.log(`[GOAL COMPLETE] Overall goal satisfied.`);
      const summary = generateExecutionSummary(context, goal.tracker);
      return {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      };
    }

    if (result.success === false || latestObs?.success === false) {
      console.log(`[AGENT] Action failed. Diagnosing...`);
      const recoveryActions = await determineRecovery(lastAction, browserState, null, retryCount);

      if (recoveryActions && recoveryActions.escalate) {
        console.log(`[RECOVERY ESCALATION] Escalating to: ${recoveryActions.state}`);
        const summary = generateExecutionSummary(context, goal.tracker);
        saveAgentSession(goal, goal.tracker, context, recoveryActions.state, null, workflowMemory);
        return {
          success: false,
          reason: recoveryActions.state,
          observation: latestObs,
          contextSummary: summary
        };
      }

      const recPlan = createPlan(goal.id, recoveryActions);
      const recResult = await executePlan(recPlan);
      if (recResult?.clientDisconnected) {
        return {
          success: false,
          reason: "client_disconnected",
          observation: latestObs,
          contextSummary: generateExecutionSummary(context, goal.tracker)
        };
      }
      latestObs = recResult?.observations?.[recResult.observations.length - 1] || latestObs;
      browserState = extractBrowserState(latestObs);
      updateWorldModel(goal, latestObs);
      retryCount++;
    } else {
      retryCount = 0;
    }
  }

  console.log(`[BUDGET] Goal action limit reached.`);
  const summary = generateExecutionSummary(context, goal.tracker);

  return {
    success: false,
    reason: "goal_action_budget_exceeded",
    observation: latestObs,
    contextSummary: summary
  };
}
