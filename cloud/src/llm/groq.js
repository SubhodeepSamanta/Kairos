import { env } from "../config/env.js";

const MAX_OUTPUT_TOKENS = 1024;

async function callGroq(model, systemPrompt, userPrompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq(${model}) failed: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

export function askGroq(systemPrompt, userPrompt) {
  return callGroq("llama-3.3-70b-versatile", systemPrompt, userPrompt);
}

export function askGroqSmall(systemPrompt, userPrompt) {
  return callGroq("llama-3.1-8b-instant", systemPrompt, userPrompt);
}
