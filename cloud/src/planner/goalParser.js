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

  const ORDINALS_MAP = {
    "first": 0, "1st": 0, "top": 0,
    "second": 1, "2nd": 1,
    "third": 2, "3rd": 2,
    "fourth": 3, "4th": 3,
    "fifth": 4, "5th": 4,
    "sixth": 5, "6th": 5,
    "seventh": 6, "7th": 6,
    "eighth": 7, "8th": 7,
    "ninth": 8, "9th": 8,
    "tenth": 9, "10th": 9
  };

  const actionWords = ["open", "click", "select", "go to", "follow", "play", "watch", "visit"];
  const hasAction = actionWords.some(w => text.includes(w));
  const hasOrdinal = Object.keys(ORDINALS_MAP).some(ord => text.includes(ord));
  const resultWords = ["result", "link", "video", "product", "post", "item", "article", "element"];
  const hasResultWord = resultWords.some(rw => text.includes(rw));

  if (hasAction && hasOrdinal && hasResultWord) {
    intent.type = "result";
    intent.action = "click";
    intent.confidence = 1;
    for (const ord of Object.keys(ORDINALS_MAP)) {
      if (text.includes(ord)) {
        intent.ordinal = ord;
        break;
      }
    }
  }

  else if (
    text.includes("search") ||
    text.includes("find") ||
    text.includes("look up") ||
    text.includes("query")
  ) {

    intent.type =
      "search";

    intent.action =
      "search";

    intent.confidence = 1;

    let query = text;
    query = query.replace(/search\s+(?:for\s+)?/i, "");
    query = query.replace(/find\s+(?:for\s+)?/i, "");
    query = query.replace(/look\s+up\s+(?:for\s+)?/i, "");
    query = query.replace(/lookup\s+(?:for\s+)?/i, "");
    query = query.replace(/query\s+(?:for\s+)?/i, "");
    intent.query = query.trim();
  }

  else if (
    text.startsWith("open") ||
    text.startsWith("go to") ||
    text.startsWith("navigate") ||
    text.startsWith("visit")
  ) {
    intent.type = "navigate";
    intent.action = "navigate";
    intent.confidence = 1;
    let target = text;
    target = target.replace(/^open\s+/i, "");
    target = target.replace(/^go\s+to\s+/i, "");
    target = target.replace(/^navigate\s+(?:to\s+)?/i, "");
    target = target.replace(/^visit\s+/i, "");
    intent.target = target.trim();
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

  if (
    intent.entities.length === 1
  ) {
    intent.target =
      intent.entities[0];
  }

intent.originalGoal =
  goal;

return intent;
}