import { askLLM } from "../llm/provider.js";

export async function extractMemory(message) {
const lower = message.toLowerCase().trim();

const actionPrefixes = [
  "open ",
  "close ",
  "focus ",
  "launch ",
  "start "
];
if (
  lower.startsWith("open") ||
  lower.startsWith("close") ||
  lower.startsWith("focus")
) {
  return {
    store: false
  };
}
for (const prefix of actionPrefixes) {
  if (lower.startsWith(prefix)) {
    return {
      store: false
    };
  }
}
if (
  lower.includes("?") ||
  lower.startsWith("what") ||
  lower.startsWith("which") ||
  lower.startsWith("who") ||
  lower.startsWith("when") ||
  lower.startsWith("where") ||
  lower.startsWith("why") ||
  lower.startsWith("how")
) {
  return {
    store: false
  };
}
  const response = await askLLM(
`You extract memories from messages.

Return ONLY valid JSON.

Examples:

Message:
my browser is chrome

Response:
{
  "store": true,
  "type": "preference",
  "key": "browser",
  "value": "chrome"
}

Message:
my github is subhodeep123

Response:
{
  "store": true,
  "type": "fact",
  "key": "github",
  "value": "subhodeep123"
}

Message:
hello

Response:
{
  "store": false
}`,
message
  );

  try {
    return JSON.parse(response);
  } catch {
    return {
      store: false
    };
  }
}