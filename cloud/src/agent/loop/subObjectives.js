export function estimateProgress(workflowMemory, browserState) {
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

export function updateSubObjectives(workflowMemory, browserState, pageUnderstanding, actionHistory) {
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

  const currentIsSearch = currentSubObjectiveMatches("search", "query", "find", "locate");
  const currentIsNavigation = currentSubObjectiveMatches("navigate", "go to", "open", "launch", "destination");
  const currentIsSelect = currentSubObjectiveMatches("select", "choose", "pick", "click", "open result");

  let satisfied = false;
  if (currentIsSearch && isOnResultsPage) {
    const activeQuery = resolvedState.parameters?.query;
    if (activeQuery) {
      const subText = (workflowMemory.currentSubObjective || "").toLowerCase();
      const queryText = activeQuery.toLowerCase();
      if (subText.includes(queryText) || queryText.includes(subText)) {
        satisfied = true;
      }
    } else {
      satisfied = true;
    }
  }
  if (currentIsNavigation && hasRealPage) satisfied = true;
  if (currentIsSelect && isOnContentPage) satisfied = true;

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

  const hasExecutedActions = actionHistory && actionHistory.some(a => a.action?.type !== "read_ui");
  const purposeIsSpecific = purpose && !["generic", "landing_page"].includes(purpose);
  let advance = false;
  const progressPercent = currentIdx / Math.max(subObjectives.length - 1, 1);

  if (hasExecutedActions) {
    if (progressPercent < 0.25 && hasRealPage && purposeIsSpecific) {
      advance = true;
    } else if (progressPercent < 0.5 && isOnResultsPage) {
      advance = true;
    } else if (progressPercent < 0.75 && isOnContentPage) {
      advance = true;
    } else if (progressPercent >= 0.75 && (isOnContentPage || purpose === "access_control")) {
      advance = true;
    }
  }

  if (advance) {
    workflowMemory.completedSubObjectives.push(workflowMemory.currentSubObjective);
    workflowMemory.currentSubObjective = subObjectives[currentIdx + 1];
    console.log(`[SUB-OBJECTIVE] Advanced to: "${workflowMemory.currentSubObjective}"`);
  }
}
