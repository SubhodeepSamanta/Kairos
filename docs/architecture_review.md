# Kairos Architecture Audit — Full Review

> **Scope**: Every file in `cloud/src/` and `client/src/` that participates in the agent loop.  
> **Methodology**: Line-by-line read of 35+ source files, compared against OpenClaw/Hermes design principles.  
> **Goal**: Surface every bug, anti-pattern, site-specific leak, and resource waste — with file:line evidence.

---

## Table of Contents

1. [Execution Loop](#1-execution-loop)
2. [Verification Chain](#2-verification-chain)
3. [Observation Pipeline](#3-observation-pipeline)
4. [Data Flow Contract](#4-data-flow-contract)
5. [World Model](#5-world-model)
6. [Task Graph](#6-task-graph)
7. [Goal & Intent Parser](#7-goal--intent-parser)
8. [Memory System](#8-memory-system)
9. [LLM Cost Accounting](#9-llm-cost-accounting)
10. [Prompt Engineering](#10-prompt-engineering)
11. [Client ↔ Server Bridge](#11-client--server-bridge)
12. [Desktop Extensibility](#12-desktop-extensibility)

---

## 1. Execution Loop

**File**: [agent.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/agent.js)

### How It Works

The `runAgent()` function is a single `for` loop (max 10 attempts). Each iteration:
1. Sets current task status → `RUNNING`
2. Sends plan to client via `executePlan(plan)`
3. Receives observations
4. If all actions succeeded → runs the **verification waterfall** (state → event → rule → LLM task → LLM goal)
5. If any verification passes → `completeTask()` → advance to next task or return success
6. If ALL verifications fail → `createReplan()` → loop again
7. If actions failed → skip verification entirely → replan

### Issues Found

#### 🔴 CRITICAL: Attempt counter reset is dangerous

```js
// agent.js L313
attempt = -1;
continue;
```

When a task is completed and the agent advances to the next task, `attempt` is reset to `-1` (becomes `0` after `attempt++`). This means **each task gets a full 10 retries**, not 10 retries for the entire goal. For a 5-task goal, the agent could loop up to **50 times**. That's 50× LLM verification calls minimum.

**Severity**: 🔴 Critical (token/cost bomb)

**OpenClaw comparison**: OpenClaw uses a single global budget (wall-clock + action count). It does NOT reset per-task.

---

#### 🟡 HIGH: No per-task retry limit

There is no separate `MAX_TASK_RETRIES`. If task 3 keeps failing verification, it consumes all 10 retries, and the agent never gets to report *which* task exhausted the budget.

**Severity**: 🟡 High

---

#### 🟡 HIGH: Failed actions skip verification entirely

```js
// agent.js L253
if (allSucceeded) {
  // ... run verification waterfall
}
```

If even one action in the plan fails, the entire verification waterfall is skipped and the agent goes straight to replanning. But a "failed" action might have actually achieved the objective (e.g., a timeout on `waitForNavigation` after a click that did navigate). The observation data is already captured — it should still be checked.

**Severity**: 🟡 High

---

#### 🟠 MEDIUM: Goal-level verification is unreachable

```js
// agent.js L11-14
if (
  goal?.tasks?.some(
    t => t.status !== "completed"
  )
) {
  return { achieved: false };
}
```

In [goalVerifier.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/goalVerifier.js#L11-L19), the first check returns `achieved: false` if **any** task is not completed. But `verifyGoal` is only called *after* all actions succeed for the current task, meaning there are always incomplete tasks ahead. **This LLM call is unreachable** — the early-return always fires.

**Severity**: 🟠 Medium (wasted code, no cost impact since early return happens before LLM call)

---

## 2. Verification Chain

### The Waterfall

When all actions succeed, the agent runs **5 verification layers** in sequence:

| Layer | File | Type | Cost |
|-------|------|------|------|
| 1. State Verifier | [stateVerifier.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/stateVerifier.js) → [stateMatchers.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/stateMatchers.js) | Programmatic | Free |
| 2. Event Verifier | [eventVerifier.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/eventVerifier.js) → [eventMatchers.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/eventMatchers.js) | Programmatic | Free |
| 3. Rule Verifier | [ruleVerifier.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/ruleVerifier.js) | Programmatic | Free |
| 4. Task Verifier | [taskVerifier.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/taskVerifier.js) | **LLM call** | $$ |
| 5. Goal Verifier | [goalVerifier.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/goalVerifier.js) | **LLM call** | $$ |

This is the correct **cost-optimized order** (free matchers first). However:

### Issues Found

#### 🔴 CRITICAL: matchNavigation verifies the WRONG TASK

```js
// stateMatchers.js L1-10
export function matchNavigation(task, observation) {
  const objective = task?.objective?.toLowerCase() || "";
  const navigationTask =
    objective.includes("open") ||
    objective.includes("navigate") ||
    objective.includes("go to");

  if (!navigationTask) { return null; }
```

The keyword guard is a good addition. But the guard is **too broad**:

- "**Open** a lofi video from results" → matches `"open"` → treated as navigation task
- Then `matchNavigation` compares `youtube.com === youtube.com` → returns `achieved: true`
- **This is the exact bug from the trace audit**: Task 3 ("Open a lofi video") gets verified by navigation match even though the task means "click a video link", not "navigate to youtube.com".

The word `"open"` appears in navigation AND non-navigation contexts. **This matcher cannot distinguish them.**

**Severity**: 🔴 Critical (causes false positives, premature task completion)

**Fix**: `matchNavigation` should ONLY fire when the task's latest action was `navigate`, not based on objective keywords.

---

#### 🔴 CRITICAL: matchMediaLoaded checks YouTube-specific URL pattern

```js
// eventMatchers.js L29-33
if (
  task?.intent === "media" &&
  observation?.pageState?.url
    ?.includes("/watch")
) {
  return { achieved: true, reason: "media_loaded" };
}
```

This is **exactly** the kind of site-specific code the user explicitly warned against. `/watch` is a YouTube URL pattern. Twitch uses `/videos/`, Vimeo uses different patterns, etc.

**Severity**: 🔴 Critical (violates core architecture principle)

---

#### 🔴 CRITICAL: matchEvents has site-specific event strings

```js
// stateMatchers.js L86-113
if (task?.intent === "authenticate" &&
    events.includes("login_page_opened")) { ... }

if (task?.intent === "media" &&
    events.includes("video_page_opened")) { ... }
```

There is **no code that ever emits** `"login_page_opened"` or `"video_page_opened"`. The [events.js](file:///c:/Users/USER/Desktop/Kairos/client/src/observer/events.js) file emits `"auth_form_detected"`, `"url_changed"`, `"content_changed"`, etc. These matchers can **never fire**. They're dead code.

**Severity**: 🟠 Medium (dead code, no functional impact, but misleading)

---

#### 🟡 HIGH: Task Verifier success criteria are unverifiable

The task verifier's system prompt says:
```
Never infer. Never assume. Never guess.
Use only evidence present in browserState or world.
```

But the task graph generates criteria like:
```json
"successCriteria": ["video is playing or ready to play"]
```

The observation layer **cannot detect whether a video is playing**. There's no DOM query for `<video>.paused`, no media event detection. So the LLM verifier will either:
- Correctly return `achieved: false` every time (causing infinite replan loops)
- Hallucinate `achieved: true` (violating its own prompt)

**Severity**: 🟡 High (root cause of the lofi test failure)

---

#### 🟡 HIGH: Goal Verifier is unreachable (duplicate of Section 1 finding)

As documented above, the early return in `goalVerifier.js` L11-19 prevents the LLM call from ever executing. The entire goal verification layer is dead code.

---

## 3. Observation Pipeline

### Data Flow

```
Client: executeAction() → result
Client: createSnapshot() → before/after
Client: executor.js assembles result + before + after + pageState
Client: observer.js wraps result into observation with events
Client: WebSocket sends { type: "execution_result", observations: [...] }
Server: WebSocket receives, extracts pageState, calls setBrowserState()
Server: agent.js consumes observations
```

### Issues Found

#### 🟡 HIGH: Observer creates fake pageState for PRESS_KEY

```js
// observer.js L360-364
{
  ...result,
  pageState: {
    text: result?.text
  }
}
```

When a key is pressed, the observer fabricates a minimal `pageState` with only `text`. This fake object gets sent to the server, where `setBrowserState()` **replaces the real browser state** with this stub:

```js
// server.js L99-108
if (pageState) {
  setBrowserState(pageState);
}
```

After a PRESS_KEY, the server's browser state becomes `{ text: "Enter" }` — no URL, no title, no buttons, no inputs. The planner then sees an empty browser state and cannot make useful decisions.

**Severity**: 🟡 High (planner loses context after every key press)

**Fix**: Don't create a fake pageState in the observer for PRESS_KEY. The executor already does a proper `readPage()` for PRESS_KEY actions (executor.js L81-92). Let the real pageState from the executor flow through.

---

#### 🟡 HIGH: Executor readPage result gets buried

```js
// executor.js L154-155
result.pageState = await readPage();
```

The executor attaches `pageState` directly to the result object. But then:

```js
// client.js L66-69
const obs = await observeAction(
  plan.actions[i],
  results[i]
);
```

The observer takes this result and builds a *new* observation object. For most action types, it does include `pageState: result.pageState`. But the observer also adds its own computed fields (`before`, `after`, `events`), and some action handlers **don't forward pageState at all**.

For PRESS_KEY specifically:
- executor.js L154 sets `result.pageState` correctly
- observer.js L338-365 **overwrites** it with `{ text: result?.text }`

The executor's careful work is discarded.

**Severity**: 🟡 High

---

#### 🟠 MEDIUM: Click observation always expects "page_changed"

```js
// observer.js L233-234
expected: "page_changed",
```

For click actions, the observer always sets `expected: "page_changed"`. But many clicks don't change the page (dropdown toggles, modals, expanding sections). This causes the `ruleVerifier` to return `achieved: false` for valid clicks where `actual === "unchanged"`.

**Severity**: 🟠 Medium

---

## 4. Data Flow Contract

### The Contract Break

The user identified this in conversation. Here's the exact evidence:

**Client executor returns an ARRAY:**
```js
// executor.js L167
return results;  // Array<Object>
```

**Client WebSocket wraps it into an object:**
```js
// client.js L58-89
const observations = [];
for (...) {
  observations.push(obs);
}
socket.send(JSON.stringify({
  type: "execution_result",
  observations
}));
```

**Server receives the object:**
```js
// server.js L72-74
if (data.type === "execution_result" && pendingResolve) {
  pendingResolve(data);  // data = { type, observations }
}
```

**Server agent consumes it:**
```js
// agent.js L155-156
const observations = result.observations || [];
```

✅ **This contract is actually correct.** The WebSocket layer (`client.js` L58-89) wraps the executor's array into `{ observations: [...] }` before sending. The server receives `data.observations` correctly. The user's earlier concern about `result.observations` being `undefined` was about a different code path.

However, there is still a subtle issue:

#### 🟠 MEDIUM: Server's `executePlanRemotely` resolves with the raw WebSocket data

```js
// server.js L118
pendingResolve(data);  // data = { type: "execution_result", observations: [...] }
```

The agent receives `{ type: "execution_result", observations: [...] }`. Then:

```js
// agent.js L155
const observations = result.observations || [];
```

This works. But `result` also contains `type: "execution_result"`, which is WebSocket framing metadata leaking into the agent logic. If the WebSocket protocol ever changes (e.g., adding `requestId` or `sessionId`), the agent will silently carry that metadata into world model updates.

**Severity**: 🟠 Medium (fragile coupling)

---

## 5. World Model

**File**: [worldModel.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/agent/worldModel.js)

### What It Tracks

| Field | Source | Updated When |
|-------|--------|-------------|
| `lastUrl` | observation.pageState.url or observation.url | Every observation |
| `lastTitle` | observation.pageState.title or observation.title | Every observation |
| `lastAction` | observation.action | Every observation |
| `lastOutcome` | computed: "success" / "failed" / "page unchanged" | Every observation |
| `history[]` | summary of each observation | Every observation, capped at 50 |
| `completedTasks[]` | { id, objective, completedAt } | On task completion |
| `failedTasks[]` | { id, objective, reason, failedAt } | On task failure |
| `failedActionHistory[]` | { action, reason, timestamp } | On non-success outcomes, capped at 20 |
| `findings[]` | arbitrary data | Never (no code calls `addFinding`) |
| `entities[]` | arbitrary data | Never (no code calls `addEntity`) |

### Issues Found

#### 🟡 HIGH: "page unchanged" is a misleading signal

```js
// worldModel.js L72-82
if (historyLen >= 2) {
  const prevObs = world.history[historyLen - 2]?.observation;
  if (prevUrl === currentUrl && prevTitle === currentTitle) {
    outcome = "page unchanged";
  }
}
```

This compares URL and title only. But many actions change the page content without changing URL or title:
- Typing text
- Scrolling
- Clicking a dropdown
- Expanding an accordion

These all get recorded as `"page unchanged"`, which the replanner interprets as "the action didn't work". This causes unnecessary replanning.

**Severity**: 🟡 High

**Fix**: Also compare `before.tabCount` and key structural indicators (button count, input count) when available.

---

#### 🟠 MEDIUM: findings[] and entities[] are dead infrastructure

`addFinding()` and `addEntity()` are exported but never called anywhere in the codebase. The world model carries empty arrays for them every iteration, and `getWorldSummary()` serializes them into the prompt (adding noise even when empty via the length check).

**Severity**: 🟠 Medium (dead code, minor prompt noise)

---

#### 🟡 HIGH: World history stores pageState summaries, but replanner uses full observation

The world model stores only `{ url, title }` from pageState:

```js
// worldModel.js L25-32
pageState: observation?.pageState
  ? { url: ..., title: ... }
  : null
```

But the replanner passes the full raw observations:

```js
// replanner.js L110-114
${JSON.stringify(
    observations.slice(-3),
    null,
    2
)}
```

These raw observations can contain full `pageState` objects with all buttons, inputs, and links. **This is where the token explosion happens.** Each observation can be 2-5KB. Three of them = 6-15KB per replan call.

**Severity**: 🟡 High (token cost)

---

## 6. Task Graph

**File**: [taskParser.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/taskParser.js)

### How It Works

An LLM call decomposes the user's goal into a list of tasks with:
- `objective`: what to achieve
- `successCriteria`: how to verify
- `requires`: prerequisites from prior tasks
- `produces`: conditions created for downstream

### Issues Found

#### 🟡 HIGH: Success criteria are ungrounded

The LLM generates criteria like:
```json
"successCriteria": ["video is playing or ready to play"]
```

There is **no mechanism** to verify media playback state. The observation layer provides:
- URL
- Title
- Visible text (first 2000 chars)
- Buttons, inputs, links, forms

It does NOT provide:
- `<video>` element state
- Audio playback state
- CSS animation state
- Modal/dialog state

Any criterion that references unobservable state will fail verification every time.

**Severity**: 🟡 High

**Fix**: The task parser prompt must constrain success criteria to observable properties:
```
Success criteria must ONLY reference:
- URL patterns (e.g., "URL contains /watch")
- Page title content
- Visible text on the page
- Presence of specific buttons, inputs, or links
```

---

#### 🟠 MEDIUM: `requires`/`produces` fields are unused

The task schema includes `requires` and `produces`, and the LLM generates them, but **no code checks whether prerequisites are satisfied** before running a task. Tasks are executed strictly in sequence (`goal.currentTask++`).

**Severity**: 🟠 Medium (unused infrastructure, wastes LLM tokens generating them)

---

#### 🟠 MEDIUM: Fallback task is too vague

```js
// taskParser.js L123-140
return [
  createTask({
    objective: goal.objective,
    successCriteria: ["goal objective is achieved"]
  })
];
```

If the LLM fails to parse tasks, the fallback creates a single task with the criterion `"goal objective is achieved"`. This is exactly the kind of vague criterion the task verifier prompt forbids. It will either always pass or always fail.

**Severity**: 🟠 Medium

---

## 7. Goal & Intent Parser

**File**: [goalParser.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/goalParser.js)

### 🔴 CRITICAL: Site-specific target list

```js
// goalParser.js L126-137
const commonTargets = [
  "youtube",
  "google",
  "github",
  "wikipedia",
  "twitter",
  "x",
  "reddit",
  "linkedin",
  "instagram"
];
```

This is **hard-coded site-specific knowledge**. A general-purpose agent should not have a built-in list of websites. This:
- Creates bias toward known sites
- Fails silently for unknown sites (e.g., "open Notion" → no target detected)
- Violates the "no site-specific code" principle

**Severity**: 🔴 Critical (violates core architecture principle)

**Fix**: Use URL detection (regex for domain patterns) or let the LLM extract the target.

---

#### 🔴 CRITICAL: Intent types are a closed enum

```js
// goalParser.js L60-116
if (text.includes("search") || ...) { intent.type = "search"; }
else if (text.includes("login") || ...) { intent.type = "authenticate"; }
else if (text.includes("video") || ...) { intent.type = "media"; }
else if (text.includes("tab")) { intent.type = "tab"; }
```

Only 5 intent types: `generic`, `search`, `authenticate`, `media`, `tab`.

Everything else falls through to `generic`. But the verification chain uses `task.intent` to decide which matchers to run:

```js
// eventMatchers.js
if (task?.intent === "media" && ...) { ... }
if (task?.intent === "authenticate" && ...) { ... }
```

So for any goal that doesn't match these 5 categories, **no programmatic verification is possible**. The agent falls through to LLM verification for every step, which is expensive.

**Severity**: 🔴 Critical

**Fix**: Remove intent-based matcher gating entirely. Matchers should check observable conditions, not intent labels.

---

#### 🟡 HIGH: Intent is assigned at goal level, not task level

```js
// agent.js L83-88
const intent = parseGoal(goal.objective);
goal.intent = intent;
```

The intent is parsed from the **goal** objective and applied to **all tasks**. But tasks have different intents:

| Goal: "Open YouTube and play a lofi video" |
|---|
| Task 1: "Open YouTube homepage" → intent should be `navigate` |
| Task 2: "Search for lofi" → intent should be `search` |
| Task 3: "Open a video" → intent should be `media` |

Currently all three tasks share `intent.type = "media"` because the goal contains "video". This causes wrong matchers to fire on wrong tasks.

**Severity**: 🟡 High

---

## 8. Memory System

**Files**: [relevant.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/memory/relevant.js), [memory directory](file:///c:/Users/USER/Desktop/Kairos/cloud/src/memory)

### How It Works

1. `SELECT * FROM memories` — fetches ALL memories from PostgreSQL
2. Scores each memory against task entities using substring matching
3. Returns top 5 matches as `key=value` strings

### Issues Found

#### 🟡 HIGH: Fetches ALL memories every call

```js
// relevant.js L7-11
const rows = await query(`
  SELECT * FROM memories
`);
```

This loads the entire memories table on every planner and replanner call. For a fresh system this is fine, but as memories accumulate, this becomes:
- A full table scan every LLM call
- Unbounded memory consumption
- Growing latency

**Severity**: 🟡 High (scalability time bomb)

**Fix**: Add WHERE clause with keyword matching or use pg_trgm extension for fuzzy search.

---

#### 🟠 MEDIUM: Scoring is naive substring matching

```js
// relevant.js L30-32
if (text.includes(term)) {
  score += 1;
}
```

Every matching term adds +1 regardless of relevance. The term "the" (if not in stop words) matches almost everything. No TF-IDF, no embedding, no recency weighting.

**Severity**: 🟠 Medium (works for now, won't scale)

---

## 9. LLM Cost Accounting

### LLM Calls Per Agent Loop Iteration

| When | Call | File |
|------|------|------|
| Goal start | `buildTaskGraph()` | taskParser.js |
| Goal start | `createGoalPlan()` | planner.js |
| Each iteration (if all succeeded) | `verifyTask()` | taskVerifier.js |
| Each iteration (if all succeeded, task verify fails) | `verifyGoal()` | goalVerifier.js |
| Each iteration (if verification fails) | `isGoalImpossible()` | failureVerifier.js |
| Each iteration (if not impossible) | `createReplan()` | replanner.js |

### Worst Case Per Iteration

If actions succeed but verification fails:

```
verifyTask()        → 1 LLM call
verifyGoal()        → 1 LLM call (actually unreachable, see Section 2)
isGoalImpossible()  → 1 LLM call  
createReplan()      → 1 LLM call
```

**= 4 LLM calls per failed iteration** (3 in practice since goalVerifier early-returns)

Over 10 retries × 5 tasks = **150 LLM calls worst case**.

### Issues Found

#### 🟡 HIGH: No token counting or budget enforcement

There is **no code** that tracks token usage across calls. The LLM provider just calls and returns. If the agent enters a verification loop, there's no circuit breaker.

**Severity**: 🟡 High

**OpenClaw comparison**: OpenClaw tracks cumulative tokens and aborts when budget is exceeded.

---

#### 🟡 HIGH: Provider fallback chain multiplies latency

```js
// provider.js L17-66
for (const provider of providers) {
  try { ... }
  catch { lastError = error; }
}
```

If Groq fails, OpenRouter is tried. If that fails, Nvidia is tried. Each failure adds latency (connection timeout + response timeout). Three sequential failures can add 30-60 seconds to a single LLM call.

**Severity**: 🟡 High (latency, not cost)

---

## 10. Prompt Engineering

**File**: [systemPrompt.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/prompts/systemPrompt.js)

### What's Good

- ✅ "Return ONLY ONE action at a time" — correct one-action-per-step design
- ✅ Element ID validation rules — prevents hallucinated element references
- ✅ Search form submission hints — reduces common planning failures
- ✅ READ_UI restrictions — prevents infinite read loops

### Issues Found

#### 🟡 HIGH: No structured output format enforcement

The prompt says "Return ONLY valid JSON" but doesn't use JSON schema or structured output mode. LLMs frequently return:
- JSON with trailing commas
- JSON wrapped in markdown code blocks
- JSON with comments

The `extractJson` function handles some of these cases, but a structured output constraint at the API level would be more reliable.

**Severity**: 🟡 High (causes intermittent parse failures → empty plans → wasted retries)

---

#### 🟠 MEDIUM: Task object is serialized twice in the prompt

```js
// systemPrompt.js L117-119
Current task:
${JSON.stringify(task, null, 2)}
```

And then in the user prompt (planner.js L123-128):
```js
task: {
  id: currentTask.id,
  objective: currentTask.objective,
  successCriteria: currentTask.successCriteria
}
```

The task appears in both the system prompt AND the user prompt. Double serialization wastes tokens.

**Severity**: 🟠 Medium

---

## 11. Client ↔ Server Bridge

### Architecture

```
Cloud (Server)                    Client (Local)
─────────────────                 ──────────────
WebSocketServer  ←─── ws ───→    WebSocket client
port 8080                         connects to cloud

Server sends:                     Client receives:
{ type: "execute_plan", plan }    → executePlan(plan)
                                  → observeAction() for each result
Client sends:                     
{ type: "execution_result",       
  observations: [...] }           

Server receives:
→ setBrowserState(pageState)
→ resolves pendingResolve(data)
```

### Issues Found

#### 🟡 HIGH: Single-client architecture with no session isolation

```js
// server.js L8-9
let connectedClient = null;
let pendingResolve = null;
```

Module-level globals. Only one client can connect. Only one pending request at a time. If two clients connect, the second replaces the first silently. If two goals run concurrently, `pendingResolve` is overwritten.

**Severity**: 🟡 High (blocks multi-client, multi-goal support)

---

#### 🟡 HIGH: No request-response correlation

```js
// server.js L172-186
return new Promise((resolve) => {
  pendingResolve = resolve;
  connectedClient.send(JSON.stringify({
    type: "execute_plan", plan
  }));
});
```

There's no `requestId` or `correlationId`. The server assumes the next `execution_result` message corresponds to the last sent plan. If messages arrive out of order or a stale result comes in from a crashed client reconnecting, the wrong resolve is called.

**Severity**: 🟡 High (race condition)

---

#### 🟠 MEDIUM: No message timeout

If the client disconnects mid-execution, `pendingResolve` is never called. The server hangs forever on that `await executePlanRemotely(plan)`. There's no timeout or heartbeat.

**Severity**: 🟠 Medium (operational reliability)

---

## 12. Desktop Extensibility

### Current State

The action schema includes desktop actions:
```js
// action.js
OPEN_APP: "open_app",
CLOSE_APP: "close_app",
FOCUS_APP: "focus_app",
```

The executor routes them:
```js
// executor.js L175-188
case ACTIONS.OPEN_APP:
  return await openApp(action.params.app);
case ACTIONS.CLOSE_APP:
  return await closeApp(action.params.app);
case ACTIONS.FOCUS_APP:
  return await focusApp(action.params.app);
```

These are imported from:
```js
import { openApp, closeApp, focusApp }
  from "../automation/desktop/windows/apps.js";
```

### Assessment

- ✅ Desktop actions exist in the action schema
- ✅ Executor routes them correctly
- ✅ Windows-specific implementation is in a platform-specific directory (`desktop/windows/`)
- ⚠️ No observation support for desktop actions — the observer has no cases for `OPEN_APP`/`CLOSE_APP`/`FOCUS_APP` (they fall through to the `default` case)
- ⚠️ No snapshot support for desktop — `createSnapshot()` only works with Playwright pages
- ⚠️ The system prompt says "browser and desktop automation" but all element IDs, browser state, and context are browser-specific

**Desktop readiness**: ~20%. The action routing exists but the observation, verification, and context layers are entirely browser-centric. A desktop action will execute but the agent has no way to observe the result or verify success.

---

## Summary of All Issues

### 🔴 Critical (7)

| # | Issue | Location |
|---|-------|----------|
| 1 | `matchNavigation` matches "open" in non-navigation tasks | [stateMatchers.js:L3-6](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/stateMatchers.js#L3-L6) |
| 2 | `matchMediaLoaded` checks YouTube-specific `/watch` URL | [eventMatchers.js:L33](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/eventMatchers.js#L33) |
| 3 | Hard-coded `commonTargets` site list | [goalParser.js:L126-137](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/goalParser.js#L126-L137) |
| 4 | Closed intent enum (5 types only) | [goalParser.js:L60-116](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/goalParser.js#L60-L116) |
| 5 | Attempt counter reset creates 50-retry bomb | [agent.js:L313](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/agent.js#L313) |
| 6 | Dead `matchEvents` checks non-existent event strings | [stateMatchers.js:L86-113](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/stateMatchers.js#L86-L113) |
| 7 | Goal-level intent applied to all tasks (wrong matcher selection) | [agent.js:L83-88](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/agent.js#L83-L88) |

### 🟡 High (9)

| # | Issue | Location |
|---|-------|----------|
| 8 | No per-task retry limit | [agent.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/agent.js) |
| 9 | Failed actions skip verification entirely | [agent.js:L253](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/agent.js#L253) |
| 10 | Observer creates fake pageState for PRESS_KEY | [observer.js:L360-364](file:///c:/Users/USER/Desktop/Kairos/client/src/observer/observer.js#L360-L364) |
| 11 | Executor readPage() overwritten by observer for PRESS_KEY | [observer.js:L338-365](file:///c:/Users/USER/Desktop/Kairos/client/src/observer/observer.js#L338-L365) |
| 12 | Unverifiable success criteria from task graph LLM | [taskParser.js:L60](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/taskParser.js#L60) |
| 13 | "page unchanged" ignores content changes | [worldModel.js:L72-82](file:///c:/Users/USER/Desktop/Kairos/cloud/src/agent/worldModel.js#L72-L82) |
| 14 | Replanner passes full raw observations (token explosion) | [replanner.js:L110-114](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/replanner.js#L110-L114) |
| 15 | Memory loads entire table every call | [relevant.js:L7-11](file:///c:/Users/USER/Desktop/Kairos/cloud/src/memory/relevant.js#L7-L11) |
| 16 | No token budget / cost tracking | All LLM callers |

### 🟠 Medium (6)

| # | Issue | Location |
|---|-------|----------|
| 17 | Goal verifier is unreachable (dead code) | [goalVerifier.js:L11-19](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/goalVerifier.js#L11-L19) |
| 18 | `requires`/`produces` unused in task execution | [taskParser.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/taskParser.js) |
| 19 | Click observation always expects "page_changed" | [observer.js:L233-234](file:///c:/Users/USER/Desktop/Kairos/client/src/observer/observer.js#L233-L234) |
| 20 | Task serialized twice in planner prompt | systemPrompt.js + planner.js |
| 21 | Single-client with no session isolation | [server.js:L8-9](file:///c:/Users/USER/Desktop/Kairos/cloud/src/websocket/server.js#L8-L9) |
| 22 | No request-response correlation in WebSocket | [server.js:L172-186](file:///c:/Users/USER/Desktop/Kairos/cloud/src/websocket/server.js#L172-L186) |

---

## Top 3 Priorities (Recommended Fix Order)

### Priority 1: Fix Verification — Make the Lofi Test Pass

**Goal**: The "Open YouTube and play a lofi video" test must reliably complete.

**Changes needed**:
1. **Remove `matchNavigation` keyword guard** — match only when `observation.action.type === "navigate"`
2. **Remove `matchMediaLoaded` URL check** — delete `/watch` pattern check entirely  
3. **Constrain task parser** to generate only observable success criteria (URL, title, visible text, element presence)
4. **Fix PRESS_KEY observer** to not overwrite real pageState

### Priority 2: Remove All Site-Specific Code

**Goal**: Zero mentions of YouTube, Google, GitHub, etc. in source code.

**Changes needed**:
1. Delete `commonTargets` from goalParser.js
2. Delete `matchMediaLoaded` from eventMatchers.js  
3. Delete dead `matchEvents` cases from stateMatchers.js
4. Replace closed intent enum with action-based detection or remove intent system entirely

### Priority 3: Control LLM Costs

**Goal**: Bounded, predictable LLM usage per goal.

**Changes needed**:
1. Add global action/LLM-call budget (e.g., max 30 LLM calls per goal)
2. Remove attempt counter reset on task completion
3. Compact observations before passing to replanner
4. Remove dead goalVerifier LLM path

---

> [!IMPORTANT]
> **No code changes have been made.** This is an audit-only document. Review and approve specific fix priorities before any implementation begins.
