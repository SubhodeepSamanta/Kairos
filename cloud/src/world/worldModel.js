import crypto from "crypto";
import { understandPage } from "./pageUnderstandingV2.js";

export function computeStateHash(pageState) {
  if (!pageState) return null;
  const normalizedState = {
    url: pageState.url || "",
    title: pageState.title || "",
    buttons: (pageState.buttons || []).map(b => ({ id: b.id, text: b.text, role: b.role, visible: b.visible })),
    inputs: (pageState.inputs || []).map(i => ({ id: i.id, text: i.text, role: i.role, value: i.value })),
    links: (pageState.links || []).map(l => ({ id: l.id, text: l.text, role: l.role })),
  };
  const str = JSON.stringify(normalizedState);
  return crypto.createHash("sha256").update(str).digest("hex");
}

export function updateWorldModel(
  goal,
  observation
) {
  const world = goal.world;
  if (!world) return;

  const previousState = {
    url: world.lastUrl,
    title: world.lastTitle,
    stateHash: world.lastStateHash
  };

  if (observation?.pageState?.tabs) {
    world.tabs = observation.pageState.tabs;
  } else if (observation?.tabs) {
    world.tabs = observation.tabs;
  }

  if (observation?.pageState?.activeTab) {
    world.activeTab = observation.pageState.activeTab;
  } else if (observation?.activeTab) {
    world.activeTab = observation.activeTab;
  }

  const stateHash = computeStateHash(observation?.pageState);

  world.history.push({
    timestamp: Date.now(),
    observation: {
      success: observation?.success,
      url: observation?.url,
      title: observation?.title,
      action: observation?.action,
      pageState: observation?.pageState
          ? {
              url: observation.pageState.url,
              title: observation.pageState.title
            }
          : null,
      events: observation?.events || [],
      reason: observation?.reason || null,
      stateHash
    }
  });

  if (world.history.length > 50) {
    world.history = world.history.slice(-50);
  }

  if (observation?.pageState?.url || observation?.url) {
    world.lastUrl = observation?.pageState?.url || observation?.url;
  }

  if (observation?.pageState?.title || observation?.title) {
    world.lastTitle = observation?.pageState?.title || observation?.title;
  }

  if (stateHash) {
    world.lastStateHash = stateHash;
  }

  // 1. Upgrade: Track page understandings cache
  world.recentPageUnderstandings = world.recentPageUnderstandings || [];
  try {
    const pageState = observation?.pageState || observation || {};
    if (pageState.url && pageState.url !== "about:blank") {
      const pageUnderstanding = understandPage(pageState);
      world.recentPageUnderstandings.push(pageUnderstanding);
      if (world.recentPageUnderstandings.length > 5) {
        world.recentPageUnderstandings = world.recentPageUnderstandings.slice(-5);
      }
    }
  } catch (e) {
    console.error("[WORLD MODEL] Page understanding generation failed:", e);
  }

  if (observation?.action) {
    world.lastAction = observation.action;
    
    // 2. Upgrade: Action history tracking
    world.actionHistory = world.actionHistory || [];
    world.actionHistory.push({
      action: observation.action,
      timestamp: Date.now()
    });
    if (world.actionHistory.length > 50) {
      world.actionHistory = world.actionHistory.slice(-50);
    }
    
    const historyLen = world.history.length;
    let outcome = "success";
    if (observation.success === false) {
      outcome = observation.reason || "failed";
    } else if (historyLen >= 2) {
      const prevObs = world.history[historyLen - 2]?.observation;
      const prevHash = prevObs?.stateHash;
      const currentHash = stateHash;
      
      if (prevHash && currentHash) {
        if (prevHash === currentHash) {
          outcome = "page unchanged";
        }
      } else {
        const prevUrl = prevObs?.url;
        const prevTitle = prevObs?.title;
        const currentUrl = observation.url || observation.pageState?.url;
        const currentTitle = observation.title || observation.pageState?.title;
        
        if (prevUrl === currentUrl && prevTitle === currentTitle) {
          outcome = "page unchanged";
        }
      }
    }
    
    world.lastOutcome = outcome;

    if (outcome !== "success") {
      world.failedActionHistory.push({
        action: observation.action,
        reason: outcome,
        timestamp: Date.now()
      });
      if (world.failedActionHistory.length > 20) {
        world.failedActionHistory = world.failedActionHistory.slice(-20);
      }
    }

    // 3. Upgrade: Progress Indicators
    world.progressIndicators = world.progressIndicators || { totalActions: 0, unchangedPagesCount: 0 };
    world.progressIndicators.totalActions++;
    if (outcome === "page unchanged") {
      world.progressIndicators.unchangedPagesCount++;
    } else {
      world.progressIndicators.unchangedPagesCount = 0;
    }
  }

  const finalState = {
    url: world.lastUrl,
    title: world.lastTitle,
    stateHash: world.lastStateHash
  };
  console.log("[WORLD MODEL UPDATE]");
  console.log(JSON.stringify({
    previousState,
    incomingState: {
      url: observation?.pageState?.url || observation?.url,
      title: observation?.pageState?.title || observation?.title
    },
    finalState,
    progressIndicators: world.progressIndicators
  }, null, 2));
}

export function recordCompletedTask(
  goal,
  task
) {
  if (!goal.world) return;

  goal.world.completedTasks.push({
    id: task.id,
    objective: task.objective,
    completedAt: Date.now()
  });
}

export function recordFailedTask(
  goal,
  task,
  reason
) {
  if (!goal.world) return;

  goal.world.failedTasks.push({
    id: task.id,
    objective: task.objective,
    reason,
    failedAt: Date.now()
  });
}

export function addFinding(
  goal,
  finding
) {
  if (!goal.world) return;

  goal.world.findings.push({
    ...finding,
    discoveredAt: Date.now()
  });

  if (goal.world.findings.length > 20) {
    goal.world.findings = goal.world.findings.slice(-20);
  }
}

export function addEntity(
  goal,
  entity
) {
  if (!goal.world) return;

  goal.world.entities.push({
    ...entity,
    discoveredAt: Date.now()
  });
}

export function getWorldSummary(
  goal
) {
  if (!goal.world) return "";

  const w = goal.world;
  const parts = [];

  if (w.lastUrl) {
    parts.push(`Current URL: ${w.lastUrl}`);
  }

  if (w.lastTitle) {
    parts.push(`Current Title: ${w.lastTitle}`);
  }

  // 4. Upgrade: Add Page Purpose/Workflow info to summary
  if (w.recentPageUnderstandings?.length > 0) {
    const latest = w.recentPageUnderstandings[w.recentPageUnderstandings.length - 1];
    parts.push(`Page Purpose: ${latest.pagePurpose}`);
    parts.push(`Page Summary: ${latest.summary || latest.pageSummary || ""}`);
  }

  if (w.completedTasks.length > 0) {
    parts.push(
      `Completed tasks: ${w.completedTasks.map(t => `${t.objective}`).join(", ")}`
    );
  }

  if (w.failedTasks.length > 0) {
    parts.push(
      `Failed tasks: ${w.failedTasks.map(t => `${t.objective}: ${t.reason}`).join(", ")}`
    );
  }

  if (w.findings.length > 0) {
    parts.push(
      `Findings: ${w.findings.map(f => JSON.stringify(f)).join(", ")}`
    );
  }

  if (w.entities.length > 0) {
    parts.push(
      `Entities: ${w.entities.map(e => JSON.stringify(e)).join(", ")}`
    );
  }

  if (w.lastAction) {
    parts.push(`Last Action: ${JSON.stringify(w.lastAction)}`);
  }

  if (w.lastOutcome) {
    parts.push(`Last Action Outcome: ${w.lastOutcome}`);
  }

  if (w.failedActionHistory.length > 0) {
    parts.push(
      `Failed Actions: ${w.failedActionHistory.map(f => `${f.action.type}(${JSON.stringify(f.action.params)}): ${f.reason}`).join(", ")}`
    );
  }

  if (w.progressIndicators) {
    parts.push(`Progress Indicators: totalActions=${w.progressIndicators.totalActions}, unchangedPagesCount=${w.progressIndicators.unchangedPagesCount}`);
  }

  return parts.join("\n");
}
