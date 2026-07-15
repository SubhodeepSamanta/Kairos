import { askGroq, askGroqSmall } from "./groq.js";
import { askOpenRouter } from "./openrouter.js";
import { askNvidia } from "./nvidia.js";

const providers = [
  { name: "groq-70b", ask: askGroq },
  { name: "openrouter", ask: askOpenRouter },
  { name: "groq-8b", ask: askGroqSmall },
  { name: "nvidia", ask: askNvidia }
];

const TPM_LIMIT = Number(process.env.LLM_TPM_LIMIT) || 10000;
const recentCalls = [];

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

async function paceForRateLimit(tokens) {
  const now = Date.now();
  while (recentCalls.length && now - recentCalls[0].at > 60000) recentCalls.shift();

  const usedThisMinute = recentCalls.reduce((sum, c) => sum + c.tokens, 0);
  if (usedThisMinute + tokens <= TPM_LIMIT) return;

  const oldest = recentCalls[0];
  if (!oldest) return;
  const waitMs = Math.max(0, 60000 - (now - oldest.at)) + 250;
  console.log(`[LLM] Pacing: ${usedThisMinute}+${tokens} tokens would exceed ${TPM_LIMIT}/min, waiting ${(waitMs / 1000).toFixed(1)}s`);
  await new Promise(r => setTimeout(r, waitMs));
  return paceForRateLimit(tokens);
}

export function createBudget(maxCalls = 45) {
  return { used: 0, maxCalls, estimatedTokens: 0 };
}

export async function askLLM(systemPrompt, userPrompt, budget = null) {
  const tokens = estimateTokens(systemPrompt) + estimateTokens(userPrompt);

  if (budget) {
    if (budget.used >= budget.maxCalls) {
      throw new Error(`llm_budget_exceeded: ${budget.maxCalls} calls`);
    }
    budget.used++;
    budget.estimatedTokens += tokens;
  }

  await paceForRateLimit(tokens);
  recentCalls.push({ at: Date.now(), tokens });

  let lastError = null;
  for (const provider of providers) {
    try {
      const result = await provider.ask(systemPrompt, userPrompt);
      if (result && result.trim()) {
        console.log(`[LLM] ${provider.name} ok (call ${budget ? budget.used : "-"}, ~${tokens} tokens in)`);
        return result;
      }
      lastError = new Error(`${provider.name} returned empty response`);
    } catch (err) {
      console.log(`[LLM] ${provider.name} failed: ${err.message.slice(0, 160)}`);
      lastError = err;
    }
  }
  throw lastError || new Error("no_llm_provider_available");
}

export function parseJsonResponse(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) cleaned = fenced[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(cleaned.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

export async function askLLMJson(systemPrompt, userPrompt, budget = null) {
  const raw = await askLLM(systemPrompt, userPrompt, budget);
  let parsed = parseJsonResponse(raw);
  if (parsed) return parsed;

  console.log(`[LLM] Invalid JSON, retrying once. Raw: ${String(raw).slice(0, 150)}`);
  const retry = await askLLM(
    systemPrompt,
    `${userPrompt}\n\nYour previous reply was not valid JSON. Reply with ONLY a single valid JSON object, no prose, no markdown.`,
    budget
  );
  parsed = parseJsonResponse(retry);
  if (parsed) return parsed;
  throw new Error("llm_invalid_json");
}
