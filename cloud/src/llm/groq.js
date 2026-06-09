import { env } from "../config/env.js";

export async function askGroq(
  systemPrompt,
  userPrompt
) {
  const response =
    await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          model:
            "llama-3.3-70b-versatile",

          messages: [
            {
              role: "system",
              content:
                systemPrompt
            },

            {
              role: "user",
              content:
                userPrompt
            }
          ],

          temperature: 0
        })
      }
    );

  if (!response.ok) {

  const errorText =
    await response.text();

  throw new Error(
    `Groq failed: ${response.status} ${errorText}`
  );
}

  const data =
    await response.json();

  return data.choices?.[0]
    ?.message?.content;
}