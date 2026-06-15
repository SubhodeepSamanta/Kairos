
export function updateWorldModel(
  goal,
  observation
) {

  const world =
    goal.world;

  if (!world) return;

  world.history.push({
    timestamp:
      Date.now(),
    observation: {
      success:
        observation?.success,
      url:
        observation?.url,
      title:
        observation?.title,
      action:
        observation?.action,
      pageState:
        observation?.pageState || null,
      events:
        observation?.events || [],
      reason:
        observation?.reason || null
    }
  });

  if (world.history.length > 50) {
    world.history =
      world.history.slice(-50);
  }

  if (
    observation?.pageState?.url ||
    observation?.url
  ) {
    world.lastUrl =
      observation?.pageState?.url ||
      observation?.url;
  }

  if (
    observation?.pageState?.title ||
    observation?.title
  ) {
    world.lastTitle =
      observation?.pageState?.title ||
      observation?.title;
  }

  // Record action outcomes and failures
  if (observation?.action) {
    world.lastAction = observation.action;
    
    // Page unchanged outcome check
    const historyLen = world.history.length;
    let outcome = "success";
    if (observation.success === false) {
      outcome = observation.reason || "failed";
    } else if (historyLen >= 2) {
      const prevObs = world.history[historyLen - 2]?.observation;
      const prevUrl = prevObs?.url;
      const prevTitle = prevObs?.title;
      const currentUrl = observation.url || observation.pageState?.url;
      const currentTitle = observation.title || observation.pageState?.title;
      
      if (prevUrl === currentUrl && prevTitle === currentTitle) {
        outcome = "page unchanged";
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
  }
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
    parts.push(
      `Current URL: ${w.lastUrl}`
    );
  }

  if (w.lastTitle) {
    parts.push(
      `Current Title: ${w.lastTitle}`
    );
  }

  if (w.completedTasks.length > 0) {
    parts.push(
      `Completed tasks: ${
        w.completedTasks.map(
          t => `${t.objective}`
        ).join(", ")
      }`
    );
  }

  if (w.failedTasks.length > 0) {
    parts.push(
      `Failed tasks: ${
        w.failedTasks.map(
          t => `${t.objective}: ${t.reason}`
        ).join(", ")
      }`
    );
  }

  if (w.findings.length > 0) {
    parts.push(
      `Findings: ${
        w.findings.map(
          f => JSON.stringify(f)
        ).join(", ")
      }`
    );
  }

  if (w.entities.length > 0) {
    parts.push(
      `Entities: ${
        w.entities.map(
          e => JSON.stringify(e)
        ).join(", ")
      }`
    );
  }

  if (w.lastAction) {
    parts.push(
      `Last Action: ${JSON.stringify(w.lastAction)}`
    );
  }

  if (w.lastOutcome) {
    parts.push(
      `Last Action Outcome: ${w.lastOutcome}`
    );
  }

  if (w.failedActionHistory.length > 0) {
    parts.push(
      `Failed Actions: ${
        w.failedActionHistory.map(
          f => `${f.action.type}(${JSON.stringify(f.action.params)}): ${f.reason}`
        ).join(", ")
      }`
    );
  }

  return parts.join("\n");
}
