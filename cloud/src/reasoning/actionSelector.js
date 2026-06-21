function tokenize(value) {
  return new Set((value || "").toLowerCase().match(/[a-z0-9]+/g) || []);
}

function overlapScore(goal, text) {
  const goalTerms = tokenize(goal);
  const textTerms = tokenize(text);
  let overlap = 0;
  for (const term of goalTerms) {
    if (textTerms.has(term)) overlap++;
  }
  return Math.min(80, overlap * 20);
}

function scoreAffordance(goal, understanding, action) {
  let score = 0;
  const text = [action.label, action.role, action.reason].filter(Boolean).join(" ");
  score += overlapScore(goal, text);

  if (action.type === "type" && /search|find|enter|type|fill|write/i.test(goal)) score += 45;
  if (action.type === "search" && /search|find|look up/i.test(goal)) score += 70;
  if (action.type === "click" && /open|click|select|choose|continue|submit|play|apply|add|next/i.test(goal)) score += 55;
  if (action.type === "navigate" && /open|go to|visit|navigate/i.test(goal)) score += 35;
  if (action.type === "read_ui" && understanding.importantElements.length === 0) score += 40;
  if (action.type === "scroll") score -= 40;
  if (action.type === "back") score -= 60;

  const constraintPenalty = understanding.constraints.some(constraint =>
    ["credential_required", "human_verification_required"].includes(constraint.type)
  ) && !/login|sign in|authenticate|verify/i.test(goal);
  if (constraintPenalty && ["type", "click"].includes(action.type)) score -= 25;

  return score;
}

function actionToPlanAction(candidate, inputText) {
  if (candidate.type === "type" || candidate.type === "search") {
    return { type: "type", params: { element: candidate.elementId, text: candidate.inputText || inputText } };
  }
  if (candidate.type === "click" || candidate.type === "navigate") {
    return { type: "click", params: { element: candidate.elementId } };
  }
  if (candidate.type === "read_ui") {
    return { type: "read_ui", params: {} };
  }
  if (candidate.type === "back") {
    return { type: "back", params: {} };
  }
  if (candidate.type === "scroll") {
    return { type: "scroll", params: { direction: candidate.direction || "down", amount: 300 } };
  }
  return null;
}

export function selectActionCandidates({ goal, inputText = null, pageUnderstanding, availableAffordances = null, limit = 8, minScore = -Infinity }) {
  const understanding = pageUnderstanding || {};
  const actions = availableAffordances || understanding.availableActions || [];
  const textToType = inputText || goal;

  return actions
    .filter(action => action && (action.elementId || ["read_ui", "back", "scroll"].includes(action.type)))
    .map(action => {
      const score = scoreAffordance(goal, understanding, action);
      return {
        ...action,
        score,
        confidence: Math.max(0.1, Math.min(0.95, score / 100)),
        inputText: action.inputText || textToType,
        planAction: actionToPlanAction(action, textToType)
      };
    })
    .filter(candidate => candidate.score >= minScore)
    .filter(candidate => candidate.planAction)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function bestActionCandidate(input) {
  return selectActionCandidates({ ...input, limit: 1 })[0] || null;
}
