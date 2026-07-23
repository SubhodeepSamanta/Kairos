import { env } from "../config/env.js";

const ENDPOINTS = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", key: () => env.GROQ_API_KEY, timeout: 15000 },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", key: () => env.OPENROUTER_API_KEY, timeout: 30000 },
  nvidia: { url: "https://integrate.api.nvidia.com/v1/chat/completions", key: () => env.NVIDIA_API_KEY, timeout: 20000 }
};

export const MAX_OUTPUT_TOKENS = 1024;

export async function callModel({ provider, model }, systemPrompt, userPrompt) {
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) throw new Error(`unknown_provider:${provider}`);
  const key = endpoint.key();
  if (!key) throw new Error(`${provider} has no API key configured`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), endpoint.timeout);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      const err = new Error(`${provider}/${model} ${response.status}: ${body.slice(0, 140)}`);
      err.status = response.status;
      err.rateLimited = response.status === 429 || /rate.?limit|quota/i.test(body);
      throw err;
    }

    const data = await response.json();
    const usage = data.usage || null;
    return {
      text: data.choices?.[0]?.message?.content || "",
      ms: Date.now() - startedAt,
      usage: usage ? {
        promptTokens: Number(usage.prompt_tokens) || 0,
        completionTokens: Number(usage.completion_tokens) || 0,
        totalTokens: Number(usage.total_tokens) || (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0)
      } : null
    };
  } finally {
    clearTimeout(timer);
  }
}
