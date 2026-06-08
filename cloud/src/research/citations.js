export function buildCitations(
  results
) {

  const lines = [];

  for (
    const result
    of results
  ) {

    lines.push(
      `• ${result.title}`
    );
  }

  return lines.join(
    "\n"
  );
}