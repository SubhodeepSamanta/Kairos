export function normalizeGoal(goal) {
  const text = (goal || "").toLowerCase().trim();
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "into", "onto", "about",
    "that", "this", "please", "search", "find", "look", "lookup",
    "open", "go", "to", "a", "an", "of", "in", "on"
  ]);

  const words = text.split(/\s+/).filter(Boolean);
  const entities = words.filter(
    word => word.length > 2 && !stopWords.has(word)
  );

  return {
    originalGoal: goal,
    tokens: words,
    entities: entities
  };
}
