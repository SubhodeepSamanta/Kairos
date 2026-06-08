export async function chatReply(
  message
) {
  const text =
    message.toLowerCase();

  if (
    text.includes("hello") ||
    text.includes("hi") ||
    text.includes("hey")
  ) {
    return "Hey! How can I help?";
  }

  if (
    text.includes("how are you")
  ) {
    return "I'm doing well. What would you like me to do?";
  }

  return "I'm Kairos. I can chat, research, and control your computer.";
}