export function normalizeGoal(goal) {
  if (!goal) return { originalGoal: "", tokens: [], entities: [] };

  const text = goal.toLowerCase().trim();
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "into", "onto", "about",
    "that", "this", "please", "search", "find", "look", "lookup",
    "open", "go", "to", "a", "an", "of", "in", "on", "is", "are"
  ]);

  const words = text.split(/\s+/).filter(word => word && word.length > 1);
  const entities = words.filter(
    word => word.length > 2 && !stopWords.has(word)
  );

  return {
    originalGoal,
    tokens: words,
    entities
  };
}
