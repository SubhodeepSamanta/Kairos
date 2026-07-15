import { env } from "../config/env.js";

export async function askNvidia(
  systemPrompt,
  userPrompt
) {

  console.log(
    "[NVIDIA] Request started"
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
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${env.NVIDIA_API_KEY}`,
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            model: "meta/llama-3.3-70b-instruct",
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
      "[NVIDIA] Status:",
      response.status
    );

    if (!response.ok) {

      const errorText =
        await response.text();

      throw new Error(
        `NVIDIA failed: ${response.status} ${errorText}`
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