export function formatResearch(
  text
) {

  return text

    .replace(
      /^Sources$/gm,
      "Sources"
    )

    .replace(
      /^Summary$/gm,
      "Summary"
    )

    .replace(
      /^\*\s/gm,
      "• "
    )

    .replace(
      /\*\*/g,
      ""
    );
}