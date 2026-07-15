import { callModel } from "./models.js";

const PRIMARY = [
  { name: "groq/gpt-oss-120b", provider: "groq", model: "openai/gpt-oss-120b" },
  { name: "groq/llama-4-scout", provider: "groq", model: "meta-llama/llama-4-scout-17b-16e-instruct" }
];

const BACKUP = [
  { name: "groq/qwen3-32b", provider: "groq", model: "qwen/qwen3-32b" },
  { name: "openrouter/nemotron-120b", provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
  { name: "groq/llama-3.3-70b", provider: "groq", model: "llama-3.3-70b-versatile" },
  { name: "nvidia/nemotron-super-49b", provider: "nvidia", model: "nvidia/llama-3.3-nemotron-super-49b-v1.5" }
];

const TPM_LIMIT = Number(process.env.LLM_TPM_LIMIT) || 10000;
const COOLDOWN_MS = 60000;

const recentCalls = [];
const cooldowns = new Map();
let rotation = 0;

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function isCooling(name) {
  const until = cooldowns.get(name);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns.delete(name);
    return false;
  }
  return true;
}

function cool(name, ms = COOLDOWN_MS) {
  cooldowns.set(name, Date.now() + ms);
}

function orderedCandidates() {
  const start = rotation++ % PRIMARY.length;
  const primaries = [...PRIMARY.slice(start), ...PRIMARY.slice(0, start)];
  const all = [...primaries, ...BACKUP];
  const ready = all.filter(c => !isCooling(c.name));
  return ready.length ? ready : all;
}

function usedByModel(name, now) {
  const calls = recentCalls.filter(c => c.name === name && now - c.at <= 60000);
  return calls.reduce((sum, c) => sum + c.tokens, 0);
}

function pruneCalls(now) {
  while (recentCalls.length && now - recentCalls[0].at > 60000) recentCalls.shift();
}

function readyCandidate(candidates, tokens) {
  const now = Date.now();
  pruneCalls(now);
  return candidates.find(c => usedByModel(c.name, now) + tokens <= TPM_LIMIT) || null;
}

async function waitForAnyModel(candidates, tokens) {
  const now = Date.now();
  const soonest = candidates
    .map(c => {
      const calls = recentCalls.filter(x => x.name === c.name && now - x.at <= 60000);
      return calls.length ? 60000 - (now - calls[0].at) : 0;
    })
    .sort((a, b) => a - b)[0];

  const waitMs = Math.max(0, soonest) + 250;
  console.log(`[LLM] All models at ${TPM_LIMIT}/min — waiting ${(waitMs / 1000).toFixed(1)}s`);
  await new Promise(r => setTimeout(r, waitMs));
}

export function createBudget(maxCalls = 45) {
  return { used: 0, maxCalls, estimatedTokens: 0 };
}

export function llmStatus() {
  return {
    primary: PRIMARY.map(p => p.name),
    backup: BACKUP.map(p => p.name),
    cooling: [...cooldowns.keys()].filter(isCooling)
  };
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

  let candidates = orderedCandidates();
  if (!readyCandidate(candidates, tokens)) {
    await waitForAnyModel(candidates, tokens);
    candidates = orderedCandidates();
  }

  const preferred = readyCandidate(candidates, tokens);
  if (preferred) {
    candidates = [preferred, ...candidates.filter(c => c.name !== preferred.name)];
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      recentCalls.push({ at: Date.now(), tokens, name: candidate.name });
      const result = await callModel(candidate, systemPrompt, userPrompt);
      if (result && result.trim()) {
        console.log(`[LLM] ${candidate.name} ok (call ${budget ? budget.used : "-"}, ~${tokens} tokens in)`);
        return result;
      }
      lastError = new Error(`${candidate.name} returned empty`);
    } catch (err) {
      lastError = err;
      if (err.rateLimited) {
        cool(candidate.name);
        console.log(`[LLM] ${candidate.name} rate limited — cooling 60s, trying next`);
      } else {
        cool(candidate.name, 15000);
        console.log(`[LLM] ${candidate.name} failed: ${err.message.slice(0, 120)}`);
      }
    }
  }
  throw lastError || new Error("no_llm_provider_available");
}

export function parseJsonResponse(text) {
  if (!text) return null;
  let cleaned = String(text).trim();
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
