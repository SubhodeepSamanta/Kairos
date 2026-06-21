function tokenize(value) {
  return new Set((value || "").toLowerCase().match(/[a-z0-9]+/g) || []);
}

export function scoreCandidate(link, position, context = {}) {
  let score = 0;

  // 1. Semantic Type Scoring (Primary factor)
  const semanticType = link.semanticType;
  if (semanticType === "primary_content") {
    score += 100;
  } else if (semanticType === "content_item") {
    score += 80;
  } else if (semanticType === "selection_candidate") {
    score += 60;
  } else if (!semanticType) {
    // Backwards compatibility fallback to legacy purpose
    const purpose = link.purpose;
    const legacyPurposes = ["video_link", "product_link", "post_link", "result_link", "search_link", "content_item", "selection_candidate"];
    if (legacyPurposes.includes(purpose)) {
      score += 50;
    }
  }

  // 2. Element Visibility
  if (link.visible !== false) {
    score += 50;
  } else {
    score -= 100; // Penalize hidden elements heavily
  }

  // 3. Position Bias (Higher up is preferred)
  score += Math.max(0, 20 - position);

  // 4. Text Quality (Descriptive text preferred over empty/short/numeric)
  const text = (link.text || "").trim();
  if (text.length > 5) {
    score += 20;
    if (text.length > 15) {
      score += 10;
    }
  } else if (text.length === 0 || /^\d+$/.test(text)) {
    score -= 20; // Penalize empty or pure numeric links
  }

  // 5. Observer Confidence
  const confidence = typeof link.confidence === "number" ? link.confidence : 0.8;
  score += confidence * 30;

  // 6. Goal and entity relevance
  const goalTerms = tokenize(context.goal);
  const candidateText = [link.text, link.title, link.ariaLabel, link.href, link.description].filter(Boolean).join(" ");
  const candidateTerms = tokenize(candidateText);
  let overlap = 0;
  for (const term of goalTerms) if (candidateTerms.has(term)) overlap++;
  score += Math.min(100, overlap * 25);

  const targetType = (context.targetType || context.semanticTarget || "").toLowerCase();
  if (targetType && candidateText.toLowerCase().includes(targetType.replace(/_/g, " "))) score += 50;
  if (link.entityType && targetType && link.entityType.toLowerCase().includes(targetType.split("_")[0])) score += 50;

  // Navigation and account chrome should rarely win a content-selection goal.
  if (link.semanticType === "navigation" || /sign in|log in|settings|notifications?|help|privacy/i.test(candidateText)) {
    score -= 180;
  }

  // Observer/memory may attach per-element historical outcomes.
  const historicalSuccess = link.historicalSuccessRate ?? context.historicalSuccess?.[link.id];
  if (typeof historicalSuccess === "number") score += (historicalSuccess - 0.5) * 80;

  return score;
}

export function rankCandidates(candidateLinks, allLinks = [], context = {}) {
  return [...candidateLinks].sort((a, b) => {
    const posA = allLinks.indexOf(a);
    const posB = allLinks.indexOf(b);
    return scoreCandidate(b, posB, context) - scoreCandidate(a, posA, context);
  });
}
