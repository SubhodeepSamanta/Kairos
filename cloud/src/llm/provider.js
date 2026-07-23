import { callModel } from "./models.js";

const PRIMARY = [
  { name: "groq/gpt-oss-120b", provider: "groq", model: "openai/gpt-oss-120b" },
  { name: "groq/gpt-oss-20b", provider: "groq", model: "openai/gpt-oss-20b" }
];

const BACKUP = [
  { name: "groq/qwen3.6-27b", provider: "groq", model: "qwen/qwen3.6-27b" },
  { name: "groq/llama-3.1-8b", provider: "groq", model: "llama-3.1-8b-instant" },
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
  return { used: 0, maxCalls, estimatedTokens: 0, tokensIn: 0, tokensOut: 0, measured: 0, llmMs: 0 };
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
  const downedProviders = new Set();
  for (const candidate of candidates) {
    if (downedProviders.has(candidate.provider)) continue;
    try {
      const record = { at: Date.now(), tokens, name: candidate.name };
      recentCalls.push(record);
      const { text, usage, ms } = await callModel(candidate, systemPrompt, userPrompt);
      if (usage) record.tokens = usage.totalTokens || tokens;
      if (text && text.trim()) {
        if (budget) {
          budget.llmMs += ms || 0;
          if (usage) {
            budget.tokensIn += usage.promptTokens;
            budget.tokensOut += usage.completionTokens;
            budget.measured++;
          }
        }
        const shown = usage ? `${usage.promptTokens} in / ${usage.completionTokens} out` : `~${tokens} in (estimated)`;
        console.log(`[LLM] ${candidate.name} ok (call ${budget ? budget.used : "-"}, ${shown}, ${ms}ms)`);
        return text;
      }
      lastError = new Error(`${candidate.name} returned empty`);
    } catch (err) {
      lastError = err;
      if (err.rateLimited) {
        cool(candidate.name);
        console.log(`[LLM] ${candidate.name} rate limited — cooling 60s, trying next`);
      } else if (err.status === 404) {
        cool(candidate.name, 6 * 3600 * 1000);
        console.log(`[LLM] ${candidate.name} returned 404 — likely decommissioned, cooling 6h`);
      } else if (/fetch failed|aborted|network|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(err.message)) {
        downedProviders.add(candidate.provider);
        for (const c of [...PRIMARY, ...BACKUP]) {
          if (c.provider === candidate.provider) cool(c.name, 15000);
        }
        console.log(`[LLM] ${candidate.name} unreachable (${err.message.slice(0, 60)}) — skipping ${candidate.provider} for 15s`);
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
