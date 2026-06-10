export function routeMessage(message) {
  const text = message
    .toLowerCase()
    .trim();

  const chatPatterns = [
    "hi",
    "hello",
    "hey",
    "how are you",
    "who are you",
    "good morning",
    "good evening"
  ];

  const researchPatterns = [
    "news",
    "latest",
    "research",
    "weather",
    "today",
    "update",
    "updates",
    "happening",
    "happened",
    "summarize",
    "summary",
    "article",
    "articles",
    "docs",
    "documentation",
    "release",
    "version"
  ];

const automationPrefixes = [
  "open",
  "close",
  "focus",
  "type",
  "search", 
  "click",
  "read",
  "scroll",
  "new ",
  "switch ",
  "list ",
  "restart "
];

for (const prefix of automationPrefixes) {
  if (text.startsWith(prefix)) {
    return {
      type: "agent"
    };
  }
}

  for (const pattern of chatPatterns) {
    if (text.includes(pattern)) {
      return {
        type: "chat"
      };
    }
  }

  for (const pattern of researchPatterns) {
    if (text.includes(pattern)) {
      return {
        type: "research"
      };
    }
  }

  return {
    type: "agent"
  };
}