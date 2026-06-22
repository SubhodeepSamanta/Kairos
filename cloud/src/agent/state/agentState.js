import { normalizeResolvedState } from "../../world/stateNormalization.js";

export function checkDeadEnd(transitionAuditHistory, resolvedCurState, transitionId, failure) {
  const normalizedCurState = normalizeResolvedState(resolvedCurState);
  const platform = normalizedCurState.capabilities && normalizedCurState.capabilities.length > 0 
    ? normalizedCurState.capabilities[0] 
    : normalizedCurState.platform;
  const auditKey = `${platform}:${normalizedCurState.currentState}_${transitionId}_${failure.type}`;
  transitionAuditHistory.push(auditKey);
  return transitionAuditHistory.slice(-3).every(x => x === auditKey) && transitionAuditHistory.length >= 3;
}
