import { env } from "../config/env.js";

export async function askOpenRouter(
  systemPrompt,
  userPrompt
) {

  console.log(
    "[OpenRouter] Request started"
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      45000
    );

  try {

    const response =
      await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            model: "meta-llama/llama-3.3-70b-instruct:free",
            max_tokens: 1024,

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
          }),

          signal:
            controller.signal
        }
      );

    console.log(
      "[OpenRouter] Status:",
      response.status
    );

    if (!response.ok) {

      const errorText =
        await response.text();

      throw new Error(
        `OpenRouter failed: ${response.status} ${errorText}`
      );
    }

    const data =
      await response.json();

    return data.choices?.[0]
      ?.message?.content;
  }

  finally {

    clearTimeout(timeout);
  }
}