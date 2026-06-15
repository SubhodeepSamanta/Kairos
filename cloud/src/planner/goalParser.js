export function parseGoal(
  goal
) {

  const text =
    goal.toLowerCase();

  const intent = {

    type: "generic",

    action: null,

    target: null,

    entities: [],

    constraints: {},

    confidence: 0
  };

  const stopWords = new Set([

    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "onto",
    "about",
    "that",
    "this",
    "please",
    "search",
"find",
"look",
"lookup",
    "open",
    "go",
    "to",
    "a",
    "an",
    "of",
    "in",
    "on",
  ]);

  const words =
    text.split(/\s+/);

  intent.entities =
    words.filter(
      word =>
        word.length > 2 &&
        !stopWords.has(word)
    );

  if (
    text.includes("search") ||
    text.includes("find") ||
    text.includes("look up")
  ) {

    intent.type =
      "search";

    intent.action =
      "search";

    intent.confidence = 1;
  }

  else if (
    text.includes("login") ||
    text.includes("log in") ||
    text.includes("sign in")
  ) {

    intent.type =
      "authenticate";

    intent.action =
      "login";

    intent.confidence = 1;
  }

  else if (
    text.includes("video") ||
    text.includes("watch") ||
    text.includes("play")
  ) {

    intent.type =
      "media";

    intent.action =
      "play";

    intent.confidence = 1;
  }

  else if (
    text.includes("tab")
  ) {

    intent.type =
      "tab";

    intent.action =
      "tab";

    intent.confidence = 1;
  }

  if (
    text.includes("new tab")
  ) {

    intent.constraints.newTab =
      true;
  }

  const commonTargets = [

    "youtube",
    "google",
    "github",
    "wikipedia",
    "twitter",
    "x",
    "reddit",
    "linkedin",
    "instagram"
  ];

  for (
    const target of commonTargets
  ) {

    if (
      text.includes(target)
    ) {

      intent.target =
        target;

      break;
    }
  }
  if (
  !intent.target &&
  intent.entities.length === 1
) {

  intent.target =
    intent.entities[0];
}

intent.originalGoal =
  goal;

return intent;
}