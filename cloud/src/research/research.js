import { searchWeb }
from "./search.js";

import { extractContent }
from "./extract.js";

import { summarizeResearch }
from "./summarize.js";

import { deduplicateSources }
from "./deduplicate.js";

import { buildCitations }
from "./citations.js";

import { formatResearch }
from "./formatter.js";

export async function runResearch(
  query
) {

  const results =
    await searchWeb(
      query
    );

  if (
    results.length === 0
  ) {
    return "No results found.";
  }

  const contents = [];

  for (
    const result
    of results
  ) {

    const content =
      await extractContent(
        result.url
      );

    if (
      content
    ) {

      contents.push(
        content
      );
    }
  }

  const unique =
    deduplicateSources(
      contents
    );

  const combined =
    unique.join(
      "\n\n"
    );

  const summary =
    await summarizeResearch(
      query,
      combined
    );

  const citations =
    buildCitations(
      results
    );

 return formatResearch(
`
Sources

${citations}

Summary

${summary}
`
);
}