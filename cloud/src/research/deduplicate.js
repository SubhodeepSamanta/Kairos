export function deduplicateSources(
  sources
) {

  const seen =
    new Set();

  const result = [];

  for (
    const source
    of sources
  ) {

    const key =
      source
        .toLowerCase()
        .slice(
          0,
          500
        );

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push(
      source
    );
  }

  return result;
}