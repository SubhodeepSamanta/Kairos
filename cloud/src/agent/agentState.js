export function checkDeadEnd(transitionAuditHistory, resolvedCurState, transitionId, failure) {
  const auditKey = `${resolvedCurState.platform}_${resolvedCurState.currentState}_${transitionId}_${failure.type}`;
  transitionAuditHistory.push(auditKey);
  return transitionAuditHistory.slice(-3).every(x => x === auditKey) && transitionAuditHistory.length >= 3;
}
