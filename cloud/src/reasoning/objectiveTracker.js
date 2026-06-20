import { normalizeResolvedState } from "../world/stateNormalization.js";

export function initTracker(objectives) {
  return {
    objectives: objectives.map(obj => ({
      ...obj,
      achieved: false,
      attempts: 0,
      startedAt: new Date().toISOString()
    })),
    currentIndex: 0,
    visitedStates: [],
    transitionHistory: [],
    attemptCount: 0,
    lastFailure: null,
    capabilityMetrics: {}
  };
}

export function updateTracker(tracker, index, status) {
  if (tracker.objectives[index]) {
    const obj = tracker.objectives[index];
    obj.attempts++;
    if (status === "completed") {
      obj.achieved = true;
    }
  }
  
  if (status === "completed" && index === tracker.currentIndex) {
    tracker.currentIndex = index + 1;
  }
}

export function recordTransition(tracker, transition, fromState, toState) {
  const normalizedFromState = normalizeResolvedState(fromState);
  const normalizedToState = normalizeResolvedState(toState);

  tracker.transitionHistory.push({
    transitionId: transition.id,
    from: normalizedFromState,
    to: normalizedToState,
    timestamp: new Date().toISOString()
  });
  
  const fromStr = `${normalizedFromState.platform}:${normalizedFromState.currentState}`;
  const toStr = `${normalizedToState.platform}:${normalizedToState.currentState}`;
  
  if (!tracker.visitedStates.includes(fromStr)) {
    tracker.visitedStates.push(fromStr);
  }
  if (!tracker.visitedStates.includes(toStr)) {
    tracker.visitedStates.push(toStr);
  }
}

export function recordCapabilityExecution(tracker, capName, outcome, recoveriesCount = 0) {
  if (!tracker.capabilityMetrics[capName]) {
    tracker.capabilityMetrics[capName] = {
      executions: 0,
      successes: 0,
      failures: 0,
      recoveries: 0
    };
  }
  const metrics = tracker.capabilityMetrics[capName];
  metrics.executions++;
  if (outcome === "success") {
    metrics.successes++;
  } else {
    metrics.failures++;
  }
  metrics.recoveries += recoveriesCount;
}
