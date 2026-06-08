export function routeMessage(message) {
  const text = message
    .toLowerCase()
    .trim();

  const chatPatterns = [
    "hi",
    "hello",
    "hey",
    "how are you",
    "who are you"
  ];

  const researchPatterns = [
    "news",
    "research",
    "latest",
    "what happened",
    "what's happening",
    "summarize"
  ];

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