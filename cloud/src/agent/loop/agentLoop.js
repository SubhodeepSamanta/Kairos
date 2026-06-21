import { createPlan } from "../../shared/schemas/plan.js";
import { llmCallCount, resetLlmCallCount, askLLM } from "../../llm/provider.js";
import { updateWorldModel, addFinding } from "../../world/worldModel.js";
import { extractDataFromPage } from "../../reasoning/extractor.js";
import { setIntent, setGoal, setPlan, setObservation } from "../state/state.js";
import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { understandPage } from "../../world/pageUnderstandingV2.js";
import { initTracker } from "../../reasoning/objectiveTracker.js";
import { verifyGoal } from "../../verification/objectiveVerifier.js";
import { createExecutionContext, generateExecutionSummary } from "../../world/executionContext.js";
import { loadAgentSession, saveAgentSession, checkForHumanIntervention } from "../state/agentSession.js";
import { reasonNextActions } from "../../reasoning/browserReasoner.js";
import { selectActionWithLLM } from "../../reasoning/llmActionSelector.js";
import { routeCapability } from "../../capabilities/router.js";
import { determineRecovery } from "../recovery/recovery.js";
import { WorkflowMemory } from "../../memory/workflowMemory.js";
import humanLoopBus from "../../humanLoop/humanLoopBus.js";
import contextManager from "../../utils/contextManager.js";
import adaptiveRecovery from "../recovery/adaptiveRecovery.js";
import resourceAllocator from "../../utils/resourceAllocator.js";
import pluginLoader from "../plugins/pluginSystem.js";
import runtimeLearning from "../../utils/runtimeLearning.js";
import contextCompressionManager from "../../utils/contextCompression.js";

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
  
  // Log token usage statistics
  const contextStats = contextManager.getContextStats();
  console.log(`[METRICS] Token Usage: ${contextStats.tokenBudget.current.total}/${contextStats.tokenBudget.budgets.total} tokens (${((contextStats.tokenBudget.current.total / contextStats.tokenBudget.budgets.total) * 100).toFixed(1)}%)");
  console.log(`[METRICS] LLM Calls: ${llmCallCount}/${maxLlmCalls}");
}

async function decomposeGoal(objective) {
  const text = (objective || "").trim();
  if (!text) return ["navigate to destination", "verify page content"];

  try {
    const systemPrompt = `You are a browser automation planner. Given a user's goal, decompose it into 3-7 sequential sub-objectives that a browser agent should complete. Each sub-objective should be a short, action-oriented phrase. Output ONLY a JSON array of strings. Example: ["navigate to site", "search for content", "select result", "extract information"]`;
    const userPrompt = `Goal: "${text}"\n\nDecompose into sub-objectives. Output ONLY a JSON array of strings.`;

    const responseText = await askLLM(systemPrompt, userPrompt);
    let cleaned = (responseText || "").trim();
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match) cleaned = match[1].trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(s => typeof s === "string")) {
      console.log(`[DECOMPOSE] LLM generated ${parsed.length} sub-objectives`);
      return parsed;
    }
  } catch (err) {
    console.error(`[DECOMPOSE] LLM decomposition failed, using fallback:`, err.message);
  }

  // Minimal generic fallback
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
  if (currentIdx === -1 || currentIdx >= subObjectives.length - 1) return;

  const purpose = (pageUnderstanding?.pagePurpose || "").toLowerCase();
  const url = (browserState.url || "").toLowerCase();

  // Advance if the page state suggests meaningful progress:
  // 1. We have a real page (not blank)
  // 2. Page purpose has changed to something more specific than "generic"
  // 3. URL has changed (navigation happened)
  const hasRealPage = url && url !== "about:blank";
  const purposeIsSpecific = purpose && purpose !== "generic";

  // Detect forward progress based on page purpose trajectory
  const isResultsPage = /result|search/.test(purpose) || url.includes("search") || url.includes("?q=");
  const isContentPage = /content|detail|media|article|product|profile/.test(purpose);
  const isFormPage = /form|login|auth/.test(purpose);

  let advance = false;
  
  // Use position in subObjectives array as a proxy for expected journey stage
  const progressPercent = currentIdx / Math.max(subObjectives.length - 1, 1);

  if (progressPercent < 0.25 && hasRealPage) {
    // Early stage: just having a real page counts as progress
    advance = true;
  } else if (progressPercent < 0.5 && (isResultsPage || purposeIsSpecific)) {
    // Mid stage: need search results or meaningful page
    advance = true;
  } else if (progressPercent < 0.75 && isContentPage) {
    // Later stage: need to be on content/detail page
    advance = true;
  } else if (progressPercent >= 0.75 && (isContentPage || isFormPage)) {
    // Final stages: any meaningful page counts
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

async function _runAgentInternal({
    goal,
    executePlan
}) {
  const initReadPlan = {
    goalId: goal.id,
    actions: [{ type: "read_ui", params: {} }]
  };
  console.log("[AGENT] Fetching initial page state...");
  const initResult = await executePlan(initReadPlan);
  const initObs = initResult?.observations?.[initResult.observations.length - 1];
  if (initObs) {
    updateWorldModel(goal, initObs);
    goal.metrics.totalActions = 0; // Reset counter after init read
  }

  let latestObs = initObs || goal.world?.history?.[goal.world.history.length - 1]?.observation;
  let browserState = extractBrowserState(latestObs);
  
  // Set initial states in context or resume session
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
    
    // Pass 7: Goal decomposition
    const subObjectives = await decomposeGoal(goal.objective);
    workflowMemory.currentObjective = goal.objective;
    workflowMemory.currentSubObjective = subObjectives[0] || goal.objective;
    workflowMemory.subObjectives = subObjectives;
    workflowMemory.completedSubObjectives = [];
  }
  goal.context = context;
  goal.workflowMemory = workflowMemory;

  // Track workflow memory intents (Pass 3)
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

  // Check for human input requirement
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

  // Check if initial page state satisfies goal
  if (await verifyGoal(goal, browserState, goal.world)) {
    console.log(`[GOAL COMPLETE] Initial browser state already satisfies the goal. Stopping execution.`);
    const summary = generateExecutionSummary(context, goal.tracker);
    return {
      success: true,
      confidence: 1.0,
      observation: latestObs,
      contextSummary: summary
    };
  }

function detectActionLoop(world) {
  const history = world.actionHistory || [];
  if (history.length < 4) return false;
  
  // Get last 4 actions
  const last4 = history.slice(-4).map(h => {
    const a = h.action;
    return `${a.type}:${a.params?.element || ""}:${a.params?.url || ""}:${a.params?.text || ""}`;
  });
  
  // If last 2 actions are identical AND the 2 before are also identical
  // = stuck in a 2-cycle
  if (last4[2] === last4[0] && last4[3] === last4[1] && last4[0] === last4[2]) {
    return true;
  }
  
  // If last 3 actions are all identical = truly stuck
  if (last4[1] === last4[2] && last4[2] === last4[3]) {
    return true;
  }
  
  return false;
}

  // Use dynamic resource allocation for action limits
  const resourceStats = resourceAllocator.getResourceStats();
  const adaptiveLimits = resourceAllocator.calculateAdaptiveLimits(goal, browserState, goal.world?.actionHistory || []);
  const MAX_GOAL_ACTIONS = adaptiveLimits.maxActions;
  goal.blacklistedCapabilities = [];
  let retryCount = 0;
  let lastAction = null;

  // Get plugin capabilities
  const pluginCapabilities = pluginLoader.getAllCapabilities();
  const pluginActions = pluginLoader.getAllActions();
  console.log(`[PLUGIN SYSTEM] Loaded ${Object.keys(pluginCapabilities).length} capabilities and ${Object.keys(pluginActions).length} actions from plugins`);

  while (goal.metrics.totalActions < MAX_GOAL_ACTIONS) {
    // Check resource availability
    if (!resourceAllocator.canExecuteAction(
      goal.metrics.totalActions,
      llmCallCount,
      goal.metrics.totalTokens || 0
    )) {
      console.log(`[RESOURCE ALLOCATOR] Resource limits reached. Actions: ${goal.metrics.totalActions}/${MAX_GOAL_ACTIONS}, LLM Calls: ${llmCallCount}/${resourceStats.current.maxLlmCalls}`);
      break;
    }
    if (detectActionLoop(goal.world)) {
      console.log("[LOOP DETECTION] Agent appears stuck in a repetitive action loop. Forcing scroll+read recovery.");
      const unstickPlan = createPlan(goal.id, [
        { type: "scroll", params: { direction: "down", amount: 500 } },
        { type: "read_ui", params: {} }
      ]);
      const prevUrlBeforeUnstick = browserState.url;
      const unstickResult = await executePlan(unstickPlan);
      latestObs = unstickResult?.observations?.[unstickResult.observations.length - 1] || latestObs;
      browserState = extractBrowserState(latestObs);
      updateWorldModel(goal, latestObs);
      if (browserState.url !== prevUrlBeforeUnstick) {
        retryCount = 0;
      } else {
        retryCount++;
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
    
    // Update sub-objectives and progress
    updateSubObjectives(workflowMemory, browserState, pageUnderstanding);
    const progress = estimateProgress(workflowMemory, browserState);
    console.log(`[PROGRESS] Current Task Progress: ${progress.percent}% - ${progress.stage}`);
    
    // Update resource allocator performance history
    resourceAllocator.updatePerformanceHistory(
      bestCandidate?.type || 'unknown',
      result?.success || false,
      Date.now() - startTime
    );
    
    // Execute plugin hooks before action selection
    const pluginData = {
      goal,
      pageUnderstanding,
      browserState,
      workflowMemory,
      bestCandidate
    };
    const pluginResults = await pluginLoader.executeAllHooks('before_action_selection', pluginData);
    console.log(`[PLUGIN SYSTEM] Executed ${pluginResults.length} plugin hooks before action selection`);
    
    // Track interaction for runtime learning
    const interaction = {
      type: 'action_selection',
      action: bestCandidate?.type || 'unknown',
      pageUrl: browserState.url || '',
      pageTitle: browserState.title || '',
      success: result?.success || false,
      error: result?.reason || '',
      sessionId: goal.id,
      userId: 'anonymous'
    };
    runtimeLearning.trackInteraction(interaction);
    
    // Compress context for LLM consumption
    const systemPrompt = `You are a browser automation planner. Given a user's goal, select the most appropriate action from the provided candidates to make progress towards the goal.`;
    const userPrompt = `Goal: "${goal.objective}"

Page: ${pageUnderstanding.pagePurpose || 'generic'}
URL: ${browserState.url || 'about:blank'}

Candidates:
${bestCandidate ? `- ${bestCandidate.label} (score: ${bestCandidate.score})` : 'No candidates available'}

Select the best action.`;
    
    const compressedContext = contextCompressionManager.compressContextForLLM(
      { pageUnderstanding, browserState, workflowMemory, goal },
      systemPrompt,
      userPrompt,
      1000
    );
    
    // Reason next actions using LLM with compressed context
    const bestCandidate = await selectActionWithLLM({
      goal,
      pageUnderstanding,
      browserState,
      workflowMemory,
      compressedContext
    });

    // Check for human input requirement in loop
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

    // If no candidate, or score is too low, attempt recovery
    if (!bestCandidate || bestCandidate.score < 20) {
      console.log(`[AGENT] Low confidence action score (${bestCandidate?.score || 0}). Running diagnoser recovery.`);
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

    // Execute best candidate action
    console.log(`[AGENT] Executing action: "${bestCandidate.label}" (score: ${bestCandidate.score})`);
    
    // Route capability to register executor usage
    for (const action of bestCandidate.actions) {
      const cap = routeCapability(action.type, goal.blacklistedCapabilities);
      if (cap) {
        cap.executions++;
      }
    }

    // Execute plugin hooks before action execution
    const pluginData = {
      goal,
      bestCandidate,
      result,
      plan
    };
    const pluginResults = await pluginLoader.executeAllHooks('before_action_execution', pluginData);
    console.log(`[PLUGIN SYSTEM] Executed ${pluginResults.length} plugin hooks before action execution`);

    const plan = createPlan(goal.id, bestCandidate.actions);
    const estimatedTokens = Math.ceil(JSON.stringify(bestCandidate.actions).length / 4);
    const resourceAllocation = resourceAllocator.allocateResources(bestCandidate.type, estimatedTokens);
    
    const result = await executePlan(plan);
    
    // Track interaction for runtime learning
    const interaction = {
      type: 'action_execution',
      action: bestCandidate?.type || 'unknown',
      pageUrl: browserState.url || '',
      pageTitle: browserState.title || '',
      success: result?.success || false,
      error: result?.reason || '',
      sessionId: goal.id,
      userId: 'anonymous'
    };
    runtimeLearning.trackInteraction(interaction);
    
    // Compress context for LLM consumption
    const systemPrompt = `You are a browser automation planner. Given a user's goal, select the most appropriate action from the provided candidates to make progress towards the goal.`;
    const userPrompt = `Goal: "${goal.objective}"

Page: ${pageUnderstanding.pagePurpose || 'generic'}
URL: ${browserState.url || 'about:blank'}

Candidates:
${bestCandidate ? `- ${bestCandidate.label} (score: ${bestCandidate.score})` : 'No candidates available'}

Select the best action.`;
    
    const compressedContext = contextCompressionManager.compressContextForLLM(
      { pageUnderstanding, browserState, workflowMemory, goal },
      systemPrompt,
      userPrompt,
      1000
    );
    
    // Execute plugin hooks after action execution
    const pluginDataAfter = {
      goal,
      bestCandidate,
      result,
      plan,
      resourceAllocation,
      interaction,
      compressedContext
    };
    const pluginResultsAfter = await pluginLoader.executeAllHooks('after_action_execution', pluginDataAfter);
    console.log(`[PLUGIN SYSTEM] Executed ${pluginResultsAfter.length} plugin hooks after action execution`);
    
    // Log compression statistics
    const compressionStats = contextCompressionManager.getCompressionStats();
    console.log(`[CONTEXT COMPRESSION] Compression stats: ${compressionStats.totalCompressions} compressions, ${compressionStats.totalSummaries} summaries, avg ratio: ${compressionStats.averageCompressionRatio.toFixed(2)}`);
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
    
    // Check for human input requirement post execution
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

    // Update world model
    updateWorldModel(goal, latestObs);

    // Extraction handling
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

    // Check if goal achieved
    if (await verifyGoal(goal, browserState, goal.world)) {
      console.log(`[GOAL COMPLETE] Overall goal satisfied.`);
      const summary = generateExecutionSummary(context, goal.tracker);
      return {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      };
    }

    // Check if execution failed
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
  
  // Log resource usage statistics
  const resourceStats = resourceAllocator.getResourceStats();
  console.log(`[RESOURCE USAGE] Actions: ${goal.metrics.totalActions}/${resourceStats.current.maxActions} (${((goal.metrics.totalActions / resourceStats.current.maxActions) * 100).toFixed(1)}%), LLM Calls: ${llmCallCount}/${resourceStats.current.maxLlmCalls} (${((llmCallCount / resourceStats.current.maxLlmCalls) * 100).toFixed(1)}%), Tokens: ${goal.metrics.totalTokens || 0}/${resourceStats.current.maxTokens} (${(( (goal.metrics.totalTokens || 0) / resourceStats.current.maxTokens) * 100).toFixed(1)}%)`);
  
  return {
    success: false,
    reason: "goal_action_budget_exceeded",
    observation: latestObs,
    contextSummary: summary
  };
}
