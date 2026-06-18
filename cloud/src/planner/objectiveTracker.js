export function initTracker(objectives) {
  return {
    objectives: objectives.map(obj => ({
      ...obj,
      achieved: false,
      attempts: 0,
      startedAt: new Date().toISOString()
    })),
    currentIndex: 0
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
