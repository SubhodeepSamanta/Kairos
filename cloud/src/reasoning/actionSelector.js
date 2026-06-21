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

export function scoreAction(goal, pageUnderstanding, candidate, failedActionHistory = []) {
  let score = 0;
  const goalLower = goal.toLowerCase();
  const purpose = pageUnderstanding?.pagePurpose || "generic";
  const label = candidate.label || "";
  const role = candidate.role || "";
  const href = candidate.href || "";
  const textContent = `${label} ${role} ${candidate.reason || ""}`.toLowerCase();

  // 1. Goal Relevance (Word overlap)
  score += overlapScore(goal, `${label} ${role} ${href}`);

  // 2. Page Relevance by Purpose
  if (purpose === "search interface") {
    if (candidate.type === "type" || candidate.type === "search") {
      score += 70;
      if (candidate.type === "search") score += 20;
    }
  } else if (purpose === "search results") {
    const isResultLink = candidate.semanticType === "content_item" || 
                         candidate.semanticType === "selection_candidate" ||
                         ["result_link", "video_link", "product_link", "post_link"].includes(candidate.purpose || "");
    if (candidate.type === "click" && (isResultLink || /watch|details|product|view/i.test(textContent))) {
      score += 160; // Prioritize clicking results on search results pages
    }
  } else if (purpose === "video player") {
    if (candidate.type === "click" && /play|pause|mute|skip|video/i.test(textContent)) {
      score += 80;
    }
  } else if (purpose === "login flow") {
    if (["type", "search"].includes(candidate.type) && /email|user|pass|login|sign/i.test(textContent)) {
      score += 70;
    }
    if (candidate.type === "click" && /submit|login|sign|confirm/i.test(textContent)) {
      score += 85;
    }
  } else if (purpose === "checkout") {
    if (candidate.type === "click" && /pay|checkout|buy|purchase|submit/i.test(textContent)) {
      score += 80;
    }
  } else if (purpose === "settings") {
    if (candidate.type === "click" && /save|apply|enable|disable|toggle/i.test(textContent)) {
      score += 65;
    }
  } else if (purpose === "catalog") {
    if (candidate.type === "click" && /repo|product|item|view|link/i.test(textContent)) {
      score += 75;
    }
  }

  // 3. Goal Intent Words Matching Action Type
  if (["type", "search"].includes(candidate.type) && /type|fill|write|enter/i.test(goalLower)) score += 40;
  if (candidate.type === "click" && /open|click|select|choose|continue|submit|play|apply|add|next/i.test(goalLower)) score += 55;
  
  if (candidate.type === "navigate") {
    if (/open|go to|visit|navigate|load/i.test(goalLower)) {
      score += 80;
    }
    const destUrl = candidate.actions?.[0]?.params?.url || "";
    for (const platform of ["youtube", "github", "amazon", "google", "wikipedia", "reddit"]) {
      if (goalLower.includes(platform) && destUrl.includes(platform)) {
        score += 150;
      }
    }
  }
  
  if (candidate.type === "extract" && /extract|get|find|retrieve|read/i.test(goalLower)) score += 100;

  // Search input typing optimization
  if (candidate.type === "search" && (candidate.purpose === "search_input" || candidate.semanticType === "search_input")) {
    score += 30; // Prefer search action over simple type action for search fields
  }

  // Penalize general actions unless necessary
  if (candidate.type === "scroll") score -= 30;
  if (candidate.type === "back") score -= 50;
  if (candidate.type === "read_ui") score -= 40;

  // 4. Constraint Handling
  const constraints = pageUnderstanding?.constraints || [];
  const hasBlockingPrompt = constraints.some(c => c.type === "blocking_prompt_possible");
  if (hasBlockingPrompt) {
    const isDismissButton = /accept|reject|close|dismiss|agree|ok/i.test(textContent);
    if (isDismissButton && candidate.type === "click") {
      score += 150;
    } else {
      score -= 60;
    }
  }

  const hasHumanVerification = constraints.some(c => c.type === "human_verification_required");
  if (hasHumanVerification && ["type", "click"].includes(candidate.type)) {
    score -= 90;
  }

  // 5. Failure History Penalties
  for (const failed of failedActionHistory) {
    if (failed.action?.type === candidate.type) {
      if (failed.action?.params?.element === candidate.elementId && candidate.elementId) {
        score -= 75;
      }
      if (failed.action?.params?.url && candidate.href && failed.action.params.url === candidate.href) {
        score -= 75;
      }
    }
  }

  return score;
}

export function rankActions(goal, pageUnderstanding, candidates, failedActionHistory = []) {
  return candidates
    .map(candidate => {
      const score = scoreAction(goal, pageUnderstanding, candidate, failedActionHistory);
      const confidence = Math.max(0.1, Math.min(0.95, score / 100));
      return {
        ...candidate,
        score,
        confidence
      };
    })
    .sort((a, b) => b.score - a.score);
}
