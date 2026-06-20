export function scoreObservation(text, cappedButtons, cappedInputs, cappedLinks) {
  const scoreReasons = [];
  let score = 1.0;

  if (text.length < 100) {
    score -= 0.5;
    scoreReasons.push("Low text content");
  }
  
  const textLower = text.toLowerCase();
  if (textLower.includes("loading...") || textLower.includes("please wait") || textLower.includes("fetching")) {
    score -= 0.3;
    scoreReasons.push("Loading text detected");
  }

  if (cappedButtons.length === 0 && cappedInputs.length === 0 && cappedLinks.length === 0) {
    score -= 0.4;
    scoreReasons.push("No interactive elements");
  }

  score = Math.max(0.0, score);

  return {
    score,
    reasons: scoreReasons
  };
}
