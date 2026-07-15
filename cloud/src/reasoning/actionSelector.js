import { parseGoal } from "./goalUnderstanding.js";

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
  const parsedGoal = parseGoal(goal);
  const label = candidate.label || "";
  const role = candidate.role || "";
  const href = candidate.href || "";
  const textContent = `${label} ${role} ${candidate.reason || ""}`.toLowerCase();

  score += overlapScore(goal, `${label} ${role} ${href}`);

  if (parsedGoal.objective === "consume media") {
    if (/play|pause|mute|skip|video|watch|stream/i.test(textContent) || ["primary_content", "media_element"].includes(candidate.semanticType || "") || candidate.purpose === "action_target") {
      score += 60;
    }
  } else if (parsedGoal.objective === "authenticate") {
    if (/login|signin|sign in|auth|credential|username|password|submit/i.test(textContent)) {
      score += 50;
    }
  } else if (parsedGoal.objective === "extract_information") {
    if (candidate.type === "extract") {
      score += 100;
    }
  }

  const resolvedCurrentState = pageUnderstanding?.resolvedState?.currentState || "";

  if (resolvedCurrentState === "home" || resolvedCurrentState === "blank") {
    if (candidate.type === "type" || candidate.type === "search") {
      score += 60;
      if (candidate.type === "search") score += 20;
    }
  } else if (resolvedCurrentState === "results") {
    const isResultLink = candidate.semanticType === "content_item" || 
                         candidate.semanticType === "selection_candidate" ||
                         candidate.semanticType === "primary_content" ||
                         ["primary_content", "navigation_target"].includes(candidate.purpose || "");
    if (candidate.type === "click" && (isResultLink || /watch|details|product|view/i.test(textContent))) {
      score += 160;
    }
  } else if (resolvedCurrentState === "content") {
    if (candidate.type === "click" && /play|pause|mute|skip|video|watch/i.test(textContent)) {
      score += 80;
    }
  } else if (resolvedCurrentState === "login") {
    if (["type", "search"].includes(candidate.type) && /email|user|pass|login|sign/i.test(textContent)) {
      score += 70;
    }
    if (candidate.type === "click" && /submit|login|sign|confirm/i.test(textContent)) {
      score += 85;
    }
  }

  if (["type", "search"].includes(candidate.type) && /type|fill|write|enter/i.test(goalLower)) score += 40;
  if (candidate.type === "click" && /open|click|select|choose|continue|submit|play|apply|add|next/i.test(goalLower)) score += 55;
  
  if (candidate.type === "navigate") {
    if (/open|go to|visit|navigate|load/i.test(goalLower)) {
      score += 80;
    }
    const constraints = pageUnderstanding?.constraints || [];
    const hasNoActivePage = constraints.some(c => c.type === "no_active_page");
    if (hasNoActivePage) {
      score += 180;
    }
    const destUrl = candidate.actions?.[0]?.params?.url || "";
    parsedGoal.constraints.forEach(constraint => {
      if (destUrl.includes(constraint)) {
        score += 150;
      }
    });
  }
  
  if (candidate.type === "extract" && /extract|get|find|retrieve|read/i.test(goalLower)) score += 100;

  if (candidate.type === "search" && (candidate.purpose === "search_input" || candidate.semanticType === "search_input")) {
    score += 30;
  }

  if (candidate.confidence) {
    score += Math.round(candidate.confidence * 20);
  }

  if (candidate.type === "scroll") score -= 30;
  if (candidate.type === "back") score -= 50;
  if (candidate.type === "read_ui") score -= 40;

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

  const hasNoActivePage = constraints.some(c => c.type === "no_active_page");
  if (hasNoActivePage && candidate.type !== "navigate") {
    score -= 300;
  }

  const hasHumanVerification = constraints.some(c => c.type === "human_verification_required");
  if (hasHumanVerification && ["type", "click"].includes(candidate.type)) {
    score -= 90;
  }

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

  if (candidate.rank !== undefined) {
    if (candidate.rank === 1) {
      score += 50;
    } else if (candidate.rank <= 3) {
      score += 30;
    } else if (candidate.rank <= 5) {
      score += 15;
    }
  }

  if (candidate.inViewport === true) {
    score += 10;
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
