export function scoreCandidate(link, position) {
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

  return score;
}

export function rankCandidates(candidateLinks, allLinks = []) {
  return [...candidateLinks].sort((a, b) => {
    const posA = allLinks.indexOf(a);
    const posB = allLinks.indexOf(b);
    return scoreCandidate(b, posB) - scoreCandidate(a, posA);
  });
}
