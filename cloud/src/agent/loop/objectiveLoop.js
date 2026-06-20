import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { updateExecutionContext, generateExecutionSummary } from "../../world/executionContext.js";
import { checkForHumanIntervention, saveAgentSession } from "../state/agentSession.js";
import { verifyObjective } from "../../verification/objectiveVerifier.js";
import { updateTracker } from "../../reasoning/objectiveTracker.js";
import { llmCallCount } from "../../llm/provider.js";

export async function processObjectives({
  goal,
  browserState,
  latestObs,
  intent,
  context,
  lastResolvedState
}) {
  const resolvedCurState = resolveCurrentState(browserState, lastResolvedState);
  
  if (latestObs) {
    const needsLlmExtraction = (intent.intent === "extract_information" || goal.tracker.objectives.some(o => o.desiredState === "information_extracted"));
    if (needsLlmExtraction) {
      const preUpdateCalls = llmCallCount;
      await updateExecutionContext(context, latestObs, resolvedCurState);
      goal.metrics.planning_calls += (llmCallCount - preUpdateCalls);
    } else {
      const pageUrl = latestObs.pageState?.url || latestObs.url;
      const pageTitle = latestObs.pageState?.title || latestObs.title;
      if (pageUrl && !context.visitedPages.some(p => p.url === pageUrl)) {
        context.visitedPages.push({
          url: pageUrl,
          title: pageTitle || "",
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  const intervention = checkForHumanIntervention(browserState);
  if (intervention) {
    console.log(`[HUMAN_INTERVENTION] State: ${intervention.state}, Reason: ${intervention.reason}`);
    const summary = generateExecutionSummary(context, goal.tracker);
    saveAgentSession(goal, goal.tracker, context, intervention.state);
    return {
      shouldExit: true,
      exitValue: {
        success: false,
        reason: intervention.state,
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  const hasQuestions = context.completedQuestions.length > 0 || context.openQuestions.length > 0;
  const allQuestionsResolved = hasQuestions && context.openQuestions.length === 0;
  if (allQuestionsResolved) {
    console.log("[GOAL COMPLETE] Early exit: All execution-context open questions have been successfully answered.");
    while (goal.tracker.currentIndex < goal.tracker.objectives.length) {
      updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
    }
    const summary = generateExecutionSummary(context, goal.tracker);
    console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    return {
      shouldExit: true,
      exitValue: {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  while (goal.tracker.currentIndex < goal.tracker.objectives.length) {
    const currentObj = goal.tracker.objectives[goal.tracker.currentIndex];
    if (verifyObjective(currentObj, browserState)) {
      updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
      console.log(`[OBJECTIVE] Achieved via state: ${currentObj.desiredState}`);
    } else {
      break;
    }
  }

  if (goal.tracker.currentIndex >= goal.tracker.objectives.length) {
    console.log("[GOAL COMPLETE] All objectives met.");
    const summary = generateExecutionSummary(context, goal.tracker);
    console.log("EXECUTION SUMMARY:", JSON.stringify(summary, null, 2));
    return {
      shouldExit: true,
      exitValue: {
        success: true,
        confidence: 0.95,
        observation: latestObs,
        contextSummary: summary
      }
    };
  }

  const currentObj = goal.tracker.objectives[goal.tracker.currentIndex];
  context.currentObjective = currentObj;

  if (currentObj.openQuestions && currentObj.openQuestions.length > 0) {
    const objQuestionsResolved = currentObj.openQuestions.every(q => 
      context.completedQuestions.some(cq => cq.question === q)
    );
    if (objQuestionsResolved) {
      console.log(`[OBJECTIVE COMPLETE] Early exit: All information gaps for objective "${currentObj.desiredState}" resolved.`);
      updateTracker(goal.tracker, goal.tracker.currentIndex, "completed");
      return { shouldContinue: true, resolvedCurState };
    }
  }

  updateTracker(goal.tracker, goal.tracker.currentIndex, "in_progress");

  return { shouldExit: false, resolvedCurState, currentObj };
}
