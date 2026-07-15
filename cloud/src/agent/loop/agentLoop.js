import { askLLMJson, createBudget } from "../../llm/provider.js";
import { SYSTEM_PROMPT, buildStepPrompt } from "../prompt.js";
import { formatSnapshot, describePageChange } from "../snapshot.js";
import { rememberFact, relevantFacts, formatFactsForPrompt } from "../../memory/store.js";
import { webSearch, formatSearchResults, fetchPageText } from "../webTools.js";
import { personaBlock } from "../../companion/personas.js";
import { buildCompanionContext } from "../../companion/context.js";
import { addTurn, addEvent, addMood } from "../../companion/store.js";
import { detectCrisis, shouldStayQuiet, CRISIS_REPLY } from "../../companion/care.js";
import { maybeSummarize } from "../../companion/summary.js";

const MAX_STEPS = 30;
const MAX_LLM_CALLS = 45;
const MAX_HISTORY_LINES = 16;
const MAX_REPEATS_BEFORE_WARNING = 2;
const MAX_REPEATS_BEFORE_ABORT = 4;
const LLM_RETRY_WAITS_MS = [8000, 20000, 45000, 0];

const BROWSER_ACTIONS = {
  navigate: a => ({ type: "navigate", params: { url: a.url } }),
  click: a => ({ type: "click", params: { element: a.id } }),
  type: a => ({ type: "type", params: { element: a.id, text: a.text, submit: a.submit === true } }),
  press_key: a => ({ type: "press_key", params: { key: a.key } }),
  scroll: a => ({ type: "scroll", params: { direction: a.direction || "down" } }),
  back: () => ({ type: "back", params: {} }),
  refresh: () => ({ type: "refresh", params: {} }),
  new_tab: () => ({ type: "new_tab", params: {} }),
  new_window: () => ({ type: "new_window", params: {} }),
  switch_tab: a => ({ type: "switch_tab", params: { index: a.index } }),
  close_tab: a => ({ type: "close_tab", params: { index: a.index } }),
  read: () => ({ type: "read_ui", params: {} }),
  wait: a => ({ type: "wait", params: { seconds: Math.min(Number(a.seconds) || 2, 10) } }),
  screenshot: () => ({ type: "screenshot", params: {} }),
  list_browsers: () => ({ type: "list_browsers", params: {} }),
  use_browser: a => ({ type: "use_browser", params: { browser: a.browser, profile: a.profile || null } })
};

const DATA_SUMMARY = {
  list_browsers: d => `\n${d.browsers}`,
  use_browser: d => ` (now using ${d.browser}${d.profileLabel ? ` profile "${d.profileLabel}"` : ""})`,
  screenshot: d => d.path ? ` (saved ${d.path})` : ""
};

const IDEMPOTENT_INFO = new Set(["list_browsers"]);

function actionSignature(action) {
  return JSON.stringify(action);
}

function normalizeAction(action) {
  if (!action || typeof action !== "object") return action;
  const { params, ...rest } = action;
  return params && typeof params === "object" ? { ...rest, ...params } : action;
}

function describeAction(action) {
  const { type, mood, thought, ...params } = normalizeAction(action);
  const rendered = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k}=${String(v).slice(0, 60)}`)
    .join(" ");
  return rendered ? `${type} ${rendered}` : type;
}

function trimHistory(history) {
  if (history.length <= MAX_HISTORY_LINES) return history;
  return [`(${history.length - MAX_HISTORY_LINES} earlier steps omitted)`, ...history.slice(-MAX_HISTORY_LINES)];
}

export async function runAgent({ goal, goalId, chatId = "default", executeAction, askHuman, onStatus }) {
  const budget = createBudget(MAX_LLM_CALLS);
  const history = [];
  const repeatCounts = {};
  const succeededResults = {};
  let lastPage = null;
  let notice = "";
  let step = 0;
  const startTime = Date.now();

  const status = (msg) => {
    console.log(`[AGENT] ${msg}`);
    if (onStatus) { try { onStatus(msg); } catch {} }
  };

  if (detectCrisis(goal)) {
    console.log("[CARE] crisis language detected — bypassing persona and agent loop");
    await addTurn(chatId, "user", goal);
    await addTurn(chatId, "assistant", CRISIS_REPLY);
    return { success: true, answer: CRISIS_REPLY, steps: 0, llmCalls: 0, care: true };
  }

  const companion = await buildCompanionContext(chatId);
  await addTurn(chatId, "user", goal);
  const systemPrompt = `${personaBlock(companion.prefs.persona)}\n\n${SYSTEM_PROMPT}`;

  if (shouldStayQuiet(goal)) {
    notice = "They are telling you how they feel, not asking for a task. Do NOT touch the browser. Reply as yourself with done — react to what they said, in character. Ask what they need only if it fits.";
  }

  const finish = async (success, answer, extra = {}) => {
    const secs = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT] ${success ? "DONE" : "FAILED"} in ${step} steps, ${budget.used} LLM calls, ~${budget.estimatedTokens} tokens, ${secs}s`);
    await addTurn(chatId, "assistant", answer);
    if (step > 0) {
      await addEvent(chatId, `${goal.slice(0, 120)}${success ? "" : " (didn't work)"}`, success, step);
    }
    maybeSummarize(chatId).catch(() => {});
    if (extra.mood && companion.prefs.moodTracking) {
      const { label, confidence, why } = extra.mood;
      if (label && Number(confidence) >= 0.5) {
        await addMood(chatId, String(label).slice(0, 24), Number(confidence), why);
        console.log(`[MOOD] ${label} (${confidence})`);
      }
    }
    return { success, answer, steps: step, llmCalls: budget.used };
  };

  while (step < MAX_STEPS) {
    step++;

    const stepPrompt = buildStepPrompt({
      goal,
      memories: formatFactsForPrompt(relevantFacts(goal)),
      history: trimHistory(history),
      snapshot: lastPage
        ? formatSnapshot(lastPage)
        : "not observed yet — use {\"type\":\"read\"} to see the current browser, navigate somewhere, or answer directly with done",
      notice,
      summary: companion.summary,
      conversation: companion.conversation,
      recentDays: companion.recentDays,
      mood: companion.mood
    });

    let decision = null;
    let llmError = null;
    for (const waitMs of LLM_RETRY_WAITS_MS) {
      try {
        decision = await askLLMJson(systemPrompt, stepPrompt, budget);
        llmError = null;
        break;
      } catch (err) {
        llmError = err;
        if (err.message.startsWith("llm_budget_exceeded")) {
          return finish(false, "I ran out of AI budget for this one. Progress: " + (history.slice(-3).join("; ") || "none"));
        }
        if (waitMs > 0) {
          status(`AI providers busy, retrying in ${waitMs / 1000}s…`);
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }
    if (!decision) {
      return finish(false, `AI error after retries: ${llmError.message}`);
    }
    notice = "";

    const action = normalizeAction(decision.action || decision);
    const thought = String(decision.thought || "").slice(0, 200);
    if (!action || typeof action.type !== "string") {
      notice = "Your reply had no valid action object. Follow the response format exactly.";
      continue;
    }
    console.log(`[STEP ${step}] ${thought} -> ${describeAction(action)}`);

    if (action.type === "done") {
      const success = action.success !== false;
      if (action.remember && typeof action.remember === "object") {
        for (const [k, v] of Object.entries(action.remember)) rememberFact(k, v);
      }
      return finish(success, action.answer || (success ? "Done." : "Couldn't do that one."), { mood: decision.mood || action.mood });
    }

    const sig = actionSignature(action);

    if (succeededResults[sig] && action.type !== "read") {
      notice = `You ALREADY ran "${describeAction(action)}" at step ${succeededResults[sig].step} and it succeeded — its result is in HISTORY and has not changed. Do not run it again. Use that result now: either answer with done, or take the NEXT step toward the goal.`;
      console.log(`[STEP ${step}] blocked repeat of already-successful ${action.type}`);
      continue;
    }

    repeatCounts[sig] = (repeatCounts[sig] || 0) + 1;
    if (repeatCounts[sig] > MAX_REPEATS_BEFORE_ABORT) {
      return finish(false, `I kept repeating the same step (${describeAction(action)}) without progress and stopped. History: ${history.slice(-3).join("; ")}`);
    }
    if (repeatCounts[sig] > MAX_REPEATS_BEFORE_WARNING) {
      notice = `You already tried "${describeAction(action)}" ${repeatCounts[sig] - 1} times. It is not working. Choose a DIFFERENT approach — usually best: web_search the exact target and navigate directly to the URL from the results.`;
    }

    if (action.type === "remember") {
      rememberFact(action.key, action.value);
      history.push(`#${step} remembered ${action.key}`);
      continue;
    }

    if (action.type === "web_search") {
      status(`Searching: ${action.query}`);
      succeededResults[sig] = { step };
      try {
        const results = await webSearch(String(action.query || ""));
        history.push(`#${step} web_search "${String(action.query).slice(0, 60)}" →\n${formatSearchResults(results).slice(0, 500)}`);
      } catch (err) {
        history.push(`#${step} web_search FAILED: ${err.message}`);
      }
      continue;
    }

    if (action.type === "fetch_page") {
      status(`Reading: ${action.url}`);
      succeededResults[sig] = { step };
      try {
        const text = await fetchPageText(String(action.url || ""));
        history.push(`#${step} fetch_page ${String(action.url).slice(0, 80)} →\n${text.slice(0, 1200)}`);
      } catch (err) {
        history.push(`#${step} fetch_page FAILED: ${err.message}`);
      }
      continue;
    }

    if (action.type === "ask_human") {
      const question = String(action.question || "I need your input to continue.");
      status("Waiting for your reply…");
      let answer;
      try {
        answer = await askHuman(question, { secretName: action.secret_name || null });
      } catch (err) {
        return finish(false, `I asked you: "${question}" but got no reply (${err.message}).`);
      }
      if (action.secret_name) {
        const name = String(action.secret_name).toLowerCase().replace(/\s+/g, "_");
        try {
          const stored = await executeAction({ type: "store_secret", params: { name, value: answer } });
          if (stored?.success) {
            history.push(`#${step} asked for secret "${name}" → saved on your machine; type it with {{secret:${name}}}`);
          } else {
            history.push(`#${step} asked for secret "${name}" → FAILED to store: ${stored?.reason || "unknown"}`);
          }
        } catch (err) {
          history.push(`#${step} asked for secret "${name}" → FAILED to store: ${err.message}`);
        }
      } else {
        history.push(`#${step} asked: "${question.slice(0, 120)}" → user replied: "${String(answer).slice(0, 300)}"`);
      }
      continue;
    }

    const toClientAction = BROWSER_ACTIONS[action.type];
    if (!toClientAction) {
      notice = `Unknown action type "${action.type}". Use only the documented actions.`;
      continue;
    }

    const clientAction = toClientAction(action);
    status(`${describeAction(action)}`);
    let observation;
    try {
      observation = await executeAction(clientAction);
    } catch (err) {
      if (err.message === "client_disconnected" || err.message === "no_client_connected") {
        return finish(false, "The Kairos client on your computer is not connected, so I cannot control the browser.");
      }
      history.push(`#${step} ${describeAction(action)} → ERROR: ${err.message}`);
      continue;
    }

    const previousPage = lastPage;
    if (observation?.page && observation.page.url !== undefined) {
      lastPage = observation.page;
    }

    if (observation?.success === false) {
      history.push(`#${step} ${describeAction(action)} → FAILED: ${String(observation.reason || "unknown").slice(0, 200)}`);
    } else {
      if (IDEMPOTENT_INFO.has(action.type)) succeededResults[sig] = { step };
      const summarize = DATA_SUMMARY[action.type];
      const extra = summarize && observation?.data ? summarize(observation.data) : "";
      const change = action.type === "list_browsers" ? "" : `; ${describePageChange(previousPage, lastPage)}`;
      history.push(`#${step} ${describeAction(action)} → ok${change}${extra}`);
    }
  }

  return finish(false, `I hit the ${MAX_STEPS}-step limit. Progress so far: ${history.slice(-4).join("; ")}`);
}
