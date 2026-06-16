export function rankElements(
  intent,
  browser
) {

const terms =
  intent?.entities || [];


  const candidates = [];

  for (
    const input of
    browser.inputs || []
  ) {

    candidates.push({
      category: "input",
      ...input
    });
  }

  for (
    const button of
    browser.buttons || []
  ) {

    candidates.push({
      category: "button",
      ...button
    });
  }

  for (
    const link of
    browser.links || []
  ) {

    candidates.push({
      category: "link",
      ...link
    });
  }

  for (
    const candidate of candidates
  ) {

    candidate.score =
      scoreCandidate(
        terms,
        candidate
      );
  }

  const ranked =
  candidates.sort(
    (a,b) =>
      b.score - a.score
  );
  return ranked;
}

function scoreCandidate(
  terms,
  candidate
) {

  const text = [
    candidate.text,
    candidate.placeholder,
    candidate.ariaLabel,
    candidate.title,
    candidate.name
  ]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();

  let score = 0;

  for (
    const term of terms
  ) {

    if (
      text === term
    ) {

      score += 20;
    }

    else if (
      text.startsWith(term)
    ) {

      score += 10;
    }

    else if (
      text.includes(term)
    ) {

      score += 5;
    }
  }

  // Boost inputs and search elements semantically
  if (
    candidate.category ===
    "input"
  ) {
    score += 2;
  }
  if (candidate.purpose && candidate.purpose !== "generic") {
    score += 8;
  }
  const textLower = text.toLowerCase();
  if (textLower.includes("search") || textLower.includes("find") || textLower.includes("query")) {
    score += 5;
  }
  return score;
}