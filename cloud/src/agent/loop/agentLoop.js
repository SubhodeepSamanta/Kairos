import { askLLMJson, createBudget } from "../../llm/provider.js";
import { SYSTEM_PROMPT, VOICE_RULES, buildStepPrompt } from "../prompt.js";
import { formatSnapshot, describePageChange } from "../snapshot.js";
import { rememberFact, relevantFacts, formatFactsForPrompt } from "../../memory/store.js";
import { webSearch, formatSearchResults, fetchPageText } from "../webTools.js";
import { personaBlock } from "../../companion/personas.js";
import { buildCompanionContext } from "../../companion/context.js";
import { addTurn, addEvent, addMood } from "../../companion/store.js";
import { detectCrisis, shouldStayQuiet, CRISIS_REPLY } from "../../companion/care.js";
import { maybeSummarize } from "../../companion/summary.js";
import { recordTrace } from "../trace.js";
import { createCancellation } from "./cancellation.js";
import { classifyConsequence, confirmationQuestion, readsAsYes } from "../consequence.js";
import { validateAction } from "../actionSchema.js";

const MAX_STEPS = 30;
const MAX_LLM_CALLS = 45;
const MAX_HISTORY_LINES = 16;
const FULL_HISTORY_TAIL = 6;
const OLD_HISTORY_CHARS = 300;
const MAX_REPEATS_BEFORE_WARNING = 2;
const MAX_REPEATS_BEFORE_ABORT = 4;
const MAX_OPENS_PER_HOST = 1;
const MAX_FRESH_TABS = 2;
const MAX_BLOCKED_BEFORE_ABORT = 4;
const LLM_RETRY_WAITS_MS = [8000, 20000, 45000, 0];
const MUTATING = new Set(["click", "type", "select_option", "press_key"]);
const MAX_MALFORMED = 5;

const BROWSER_ACTIONS = {
  navigate: a => ({ type: "navigate", params: { url: a.url } }),
  click: a => ({ type: "click", params: { element: a.id } }),
  type: a => ({ type: "type", params: { element: a.id, text: a.text, submit: a.submit === true } }),
  select_option: a => ({ type: "select_option", params: { element: a.id, value: a.value } }),
  open_for_user: a => ({ type: "open_for_user", params: { url: a.url } }),
  close_user_browser: a => ({ type: "close_user_browser", params: { browser: a.browser } }),
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
  use_browser: a => ({ type: "use_browser", params: { browser: a.browser, profile: a.profile || null } }),
  list_files: a => ({ type: "list_files", params: { path: a.path || "" } }),
  read_file: a => ({ type: "read_file", params: { path: a.path } }),
  write_file: a => ({ type: "write_file", params: { path: a.path, text: a.text } })
};

const DATA_SUMMARY = {
  list_browsers: d => `\n${d.browsers}`,
  use_browser: d => ` (now using ${d.browser}${d.profileLabel ? ` profile "${d.profileLabel}"` : ""})`,
  screenshot: d => d.path ? ` (saved ${d.path})` : "",
  click: d => d?.newTabOpened ? " (it opened a new tab, which is now the active one)" : "",
  select_option: d => d?.selected ? ` (selected "${d.selected}")` : "",
  open_for_user: d => d?.opened ? ` (${d.opened} opened as a tab in the user's OWN browser — done, you cannot see that tab)` : "",
  close_user_browser: d => d?.closed ? ` (their ${d.label || "browser"} is closed — retry the real profile with use_browser now)` : " (it was not running — the real profile is free)",
  list_files: d => d?.listing ? `\n${d.listing}` : "",
  read_file: d => d?.text ? `\n${d.text}${d.truncated ? "\n…(file continues)" : ""}` : "",
  write_file: d => d?.written ? ` (saved as ${d.written})` : ""
};

const IDEMPOTENT_INFO = new Set(["list_browsers", "list_files", "read_file"]);

function actionSignature(action) {
  return JSON.stringify(action);
}

function hostOf(url) {
  try {
    return new URL(String(url)).host.replace(/^www\./, "");
  } catch {
    return null;
  }
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
  const kept = history.length > MAX_HISTORY_LINES
    ? [`(${history.length - MAX_HISTORY_LINES} earlier steps omitted)`, ...history.slice(-MAX_HISTORY_LINES)]
    : [...history];
  const cutoff = kept.length - FULL_HISTORY_TAIL;
  return kept.map((entry, i) =>
    i < cutoff && entry.length > OLD_HISTORY_CHARS ? `${entry.slice(0, OLD_HISTORY_CHARS)} …(older detail trimmed)` : entry
  );
}

export async function runAgent({
  goal, tone = null, goalId, chatId = "default", executeAction, askHuman, onStatus,
  voiceMode = false, isCancelled,
  confirmRisky = process.env.CONFIRM_RISKY !== "false",
  dryRun = process.env.DRY_RUN === "true"
}) {
  const budget = createBudget(MAX_LLM_CALLS);
  const history = [];
  const repeatCounts = {};
  const succeededResults = {};
  const approved = new Set();
  const openedHosts = new Map();
  let freshTabs = 0;
  let blockedSteps = 0;
  let malformedSteps = 0;
  let lastPage = null;
  let notice = "";
  let step = 0;
  let justRead = false;
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
  const systemPrompt = `${personaBlock(companion.prefs.persona)}\n\n${SYSTEM_PROMPT}${voiceMode ? `\n\n${VOICE_RULES}` : ""}`;

  if (shouldStayQuiet(goal)) {
    notice = "They are telling you how they feel, not asking for a task. Do NOT touch the browser. Reply as yourself with done — react to what they said, in character. Ask what they need only if it fits.";
  }

  if (tone) {
    notice = `${notice ? `${notice} ` : ""}How they SOUND right now: ${tone}. That is how their voice reads against their own normal, not what they said. Let it colour your tone if it fits; never mention it or repeat it back.`;
  }

  const finish = async (success, answer, extra = {}) => {
    const secs = ((Date.now() - startTime) / 1000).toFixed(1);
    const measured = budget.measured > 0;
    const tokens = measured ? budget.tokensIn + budget.tokensOut : budget.estimatedTokens;
    console.log(`[AGENT] ${success ? "DONE" : "FAILED"} in ${step} steps, ${budget.used} LLM calls, ${tokens} tokens${measured ? "" : " (estimated)"}, ${secs}s`);
    recordTrace({
      goal, success, answer, steps: history,
      cancelled: extra.cancelled,
      seconds: secs, llmCalls: budget.used,
      tokens, tokensIn: budget.tokensIn, tokensOut: budget.tokensOut,
      measured, llmMs: budget.llmMs
    });
    await addTurn(chatId, "assistant", answer);
    if (history.length > 0) {
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

  const { stopped, raceCancel, sleepUnlessStopped } = createCancellation(isCancelled);

  while (step < MAX_STEPS) {
    if (stopped()) {
      status("cancelled by the user");
      return finish(false, step > 0 ? "okay — stopped." : "okay, never mind.", { cancelled: true });
    }
    step++;

    const stepPrompt = buildStepPrompt({
      goal,
      memories: formatFactsForPrompt(relevantFacts(goal)),
      history: trimHistory(history),
      snapshot: lastPage
        ? formatSnapshot(lastPage, { fullText: justRead })
        : "NO browser action has run this goal — anything they asked you to open/play/do is NOT done yet, no matter what CONVERSATION or MEMORIES say. Act first (open_for_user, navigate, or read). done without acting is ONLY for pure conversation or answers you know.",
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
          if (!await sleepUnlessStopped(waitMs)) break;
        }
      }
    }
    if (stopped()) {
      status("cancelled by the user");
      return finish(false, step > 1 ? "okay — stopped." : "okay, never mind.", { cancelled: true });
    }
    if (!decision) {
      return finish(false, `AI error after retries: ${llmError?.message || "no answer from any model"}`);
    }
    notice = "";

    const action = normalizeAction(decision.action || decision);
    const thought = String(decision.thought || "").slice(0, 200);
    const malformed = validateAction(action);
    if (malformed) {
      console.log(`[STEP ${step}] rejected before running: ${malformed}`);
      notice = malformed;
      step--;
      malformedSteps++;
      if (malformedSteps >= MAX_MALFORMED) {
        return finish(false, `The AI kept replying with actions I could not run (${malformed}). Progress: ${history.slice(-3).join("; ") || "none"}`);
      }
      continue;
    }
    console.log(`[STEP ${step}] ${thought} -> ${describeAction(action)}`);

    if (stopped() && action.type !== "done") {
      status("cancelled by the user");
      return finish(false, "okay — stopped.", { cancelled: true });
    }

    justRead = action.type === "read";

    if (action.type === "done") {
      const success = action.success !== false;
      if (action.remember && typeof action.remember === "object") {
        for (const [k, v] of Object.entries(action.remember)) rememberFact(k, v);
      }
      return finish(success, action.answer || (success ? "Done." : "Couldn't do that one."), { mood: decision.mood || action.mood });
    }

    const sig = actionSignature(action);

    const blockStep = (why, logLine) => {
      blockedSteps++;
      console.log(`[STEP ${step}] ${logLine}`);
      if (blockedSteps >= MAX_BLOCKED_BEFORE_ABORT) {
        return finish(false, `I kept trying to redo things I had already done (${describeAction(action)}) and stopped myself before making a mess. Progress: ${history.slice(-3).join("; ") || "none"}`);
      }
      notice = why;
      return null;
    };

    if (succeededResults[sig] && action.type !== "read") {
      const aborted = blockStep(
        `You ALREADY ran "${describeAction(action)}" at step ${succeededResults[sig].step} and it succeeded — its result is in HISTORY and has not changed. Do not run it again. Use that result now: either answer with done, or take the NEXT step toward the goal.`,
        `blocked repeat of already-successful ${action.type}`
      );
      if (aborted) return aborted;
      continue;
    }

    if (action.type === "open_for_user") {
      const host = hostOf(action.url);
      const opened = host ? openedHosts.get(host) : null;
      if (opened && opened.count >= MAX_OPENS_PER_HOST) {
        const aborted = blockStep(
          `You ALREADY opened ${host} in their browser (last at step ${opened.step}) — opening it again only piles up tabs. If the goal was to open/show something there, it is DONE: reply done now with what you opened. Otherwise take a genuinely different step.`,
          `blocked open_for_user — ${host} already opened ${opened.count}x`
        );
        if (aborted) return aborted;
        continue;
      }
    }

    if (action.type === "new_tab" || action.type === "new_window") {
      if (freshTabs >= MAX_FRESH_TABS) {
        const aborted = blockStep(
          `You already opened ${freshTabs} fresh tabs this goal. No more tabs — work in the tab you have (navigate there directly), or reply done.`,
          `blocked ${action.type} — ${freshTabs} fresh tabs already`
        );
        if (aborted) return aborted;
        continue;
      }
      freshTabs++;
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
      try {
        const results = await webSearch(String(action.query || ""));
        succeededResults[sig] = { step };
        history.push(`#${step} web_search "${String(action.query).slice(0, 60)}" →\n${formatSearchResults(results).slice(0, 500)}`);
      } catch (err) {
        history.push(`#${step} web_search FAILED: ${err.message}`);
      }
      continue;
    }

    if (action.type === "fetch_page") {
      status(`Reading: ${action.url}`);
      try {
        const text = await fetchPageText(String(action.url || ""));
        succeededResults[sig] = { step };
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
        answer = await raceCancel(askHuman(question, { secretName: action.secret_name || null }));
      } catch (err) {
        if (err.message === "cancelled_by_user") {
          status("cancelled by the user");
          return finish(false, "okay — stopped.", { cancelled: true });
        }
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

    if (dryRun && MUTATING.has(action.type)) {
      history.push(`#${step} ${describeAction(action)} → NOT RUN (dry run)`);
      notice = "DRY RUN: you may not click, type, submit or select anything. Nothing above was actually done. Say what you WOULD do, in order, and finish with done.";
      continue;
    }

    const consequence = confirmRisky ? classifyConsequence(action, lastPage) : null;
    if (consequence && !approved.has(sig)) {
      const question = confirmationQuestion(consequence, lastPage);
      status("Waiting for you to confirm…");
      let answer;
      try {
        answer = await raceCancel(askHuman(question, {}));
      } catch (err) {
        if (err.message === "cancelled_by_user") {
          status("cancelled by the user");
          return finish(false, "okay — stopped.", { cancelled: true });
        }
        return finish(false, `I stopped before I could ${consequence.kind} — I asked "${question}" and got no reply.`);
      }
      if (!readsAsYes(answer)) {
        history.push(`#${step} did NOT ${describeAction(action)} — they said no`);
        notice = `They said NO to ${consequence.what}. Do not try it again or find another route to it. Either continue the goal a different way, or finish with done explaining what you did not do.`;
        continue;
      }
      approved.add(sig);
      console.log(`[CONFIRM] approved: ${consequence.kind} — ${consequence.what}`);
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
      if (action.type === "open_for_user") {
        const host = hostOf(action.url);
        if (host) {
          const opened = openedHosts.get(host) || { count: 0, step };
          openedHosts.set(host, { count: opened.count + 1, step });
        }
      }
      const summarize = DATA_SUMMARY[action.type];
      const extra = summarize && observation?.data ? summarize(observation.data) : "";
      const change = action.type === "list_browsers" ? "" : `; ${describePageChange(previousPage, lastPage)}`;
      history.push(`#${step} ${describeAction(action)} → ok${change}${extra}`);
    }
  }

  return finish(false, `I hit the ${MAX_STEPS}-step limit. Progress so far: ${history.slice(-4).join("; ")}`);
}
