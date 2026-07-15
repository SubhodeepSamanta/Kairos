# Kairos — Honest Assessment & Rebuild Plan (July 2026)

> Written after a full read of the codebase, docs, session traces, and git history.
> Purpose: explain **why** 100 hours of work didn't produce a working agent, what to
> keep, what to delete, and the exact order to rebuild in.

---

## 1. The honest diagnosis

**The architecture is not the problem. The reasoning strategy is.**

The cloud/client split, the WebSocket bridge, the Playwright action layer, the
Telegram/CLI connectors — all of that is sound and matches how real products
(OpenAI Operator, browser-use, Claude computer-use) are shaped. Tests pass (85/85).
The plumbing works.

What fails is the **decision-making core**, and it fails for one root reason:

> **Kairos was built "heuristics-first, LLM-assist." Every working browser agent
> in 2026 is built "LLM-first, heuristics-guard."**

The current pipeline per step:

```
readPage → regex element classifier → regex page classifier
        → pageUnderstandingV2 (purpose inference) → currentStateResolver
        → generateActions (heuristic candidates) → rankElements
        → LLM picks from candidates → matchLlmActionToCandidate
        → heuristic fallback scoring if no match → execute
        → updateSubObjectives (keyword matching) → objectiveVerifier (heuristic gate → LLM)
```

That's ~8 layers of hand-written guesses wrapped around one constrained LLM call.
Each layer is a place where information is **lost, distorted, or overridden** before
the only intelligent component ever sees it. The failure evidence is already in this
repo's own docs:

- `failing_hop_analysis.md`: GitHub search failed because `inputs.slice(0, 10)`
  **sliced the search box out of the observation**. The LLM never had a chance —
  the heuristic serialization hid the element from it.
- `sessions/session_youtube_gen_1.json`: 38 attempts to play a lofi video;
  28 type-actions, 0 successes; agent ping-ponged between pages.
- `current.md` (your own audit): "Action generation still has site-specific
  references despite attempts to generalize."

And the pattern in git history (`"still all broken"`, `"idk hope it works"`,
`"fixing heuristics"`) shows the trap: **every failure was patched with another
heuristic** — loop detectors, stale-ref counters, sub-objective skip rules,
recovery diagnosers, per-element failure counters. Each patch adds a new way to be
wrong on the next website. The web is too diverse; regex classifiers are hardcoding
in disguise. That's why "one more fix" never converged.

### Concrete bugs found in the current loop (examples, not exhaustive)

| Where | Bug |
|---|---|
| `agentLoop.js` ~L689 | Stale-ref check compares `latestObs.url !== browserState.url`, but `browserState` was just extracted **from** `latestObs` — always equal, so `pageChanged` is always false and every 2nd successful action triggers a pointless forced re-read. |
| `websocket/server.js` `executePlanRemotely` | No timeout, no requestId. If the client crashes mid-plan the promise hangs **forever**. Sequential plans share `goalId` as the resolver key. |
| `updateSubObjectives` | Advances sub-objectives by keyword matching ("search", "select"…) against page purpose strings. Routinely advances on the wrong page, so the agent works on the wrong step. |
| `matchLlmActionToCandidate` | If the LLM picks an action the candidate generator didn't pre-generate → `LLM_MATCH_MISS` → falls back to heuristic scoring. The smartest component gets vetoed by the dumbest. |
| `executor.js` SPA-wait | Polls full `readPage()` (all readers + classifiers) every 250 ms for up to 8 s after every click. |
| `objectiveVerifier.js` | Heuristic pass **gates** the LLM pass — if the heuristic says "not done," the LLM is never asked, so completion on unanticipated page shapes is invisible. |

### What this means

Roughly **60–70% of `cloud/src` should be deleted, not fixed**. That sounds brutal
after 100 hours, but the hours weren't wasted: the client action layer, the ARIA
reader direction (recent uncommitted work — correct instinct!), the WS shape, the
connectors, and most importantly *the hard-won knowledge of every failure mode* are
exactly what makes the rebuild fast. You already discovered, the hard way, every
reason the heuristic path can't work. The docs claiming "96% readiness" were
aspiration, not measurement — this document replaces them.

---

## 2. What to KEEP

| Component | Verdict |
|---|---|
| Cloud/client split over WebSocket | Keep. Right shape for Render-hosted brain + laptop hands. |
| `client/src/automation/browser/actions/*` (navigate, click, type, press_key, scroll, tabs, back/refresh, screenshot, wait) | Keep with light cleanup. The primitives are fine. |
| `ariaReader.js` (new, uncommitted) | Keep the idea — it becomes the **primary** snapshot source. |
| `visionReader.js` (OCR fallback) | Keep as optional last-resort fallback, lazy-loaded (already is). |
| Element registry (`registry.js`) | Keep — id → locator mapping is the right pattern. |
| LLM provider fallback chain (Groq → OpenRouter → Nvidia) | Keep. Model-agnostic is good. |
| Telegram + CLI connectors, human-loop bus | Keep. |
| PostgreSQL memory storage | Keep the table; simplify retrieval later. |
| Vitest suites | Keep and grow. |

## 3. What to DELETE (the LLM-avoidance layer)

All of this is replaced by *one well-prompted LLM call per step*:

- `cloud/src/reasoning/`: `actionGenerator.js`, `actionSelector.js`,
  `goalUnderstanding.js`, `goalNormalizer.js`, `affordanceExtractor.js`,
  `objectiveTracker.js`, most of `llmActionSelector.js` (keep JSON-parsing utils)
- `cloud/src/world/`: `pageUnderstandingV2.js` (+ `.backup`), `pageUnderstanding.js`,
  `currentStateResolver.js`, `stateNormalization.js`
- `cloud/src/verification/`: everything except a thin LLM "is the goal done / what's
  the answer" check folded into the main loop (`goalVerifier`, `failureVerifier`,
  `eventVerifier`, `eventMatchers`, `stateVerifier`, `stateMatchers`,
  `unifiedVerifier` — most are already dead code)
- `cloud/src/agent/`: `ranking/ranker.js`, `recovery/adaptiveRecovery.js` (simulated,
  doesn't execute), most of `diagnoser.js`; sub-objective machinery in `agentLoop.js`
- `client/src/automation/browser/actions/classifier/` (all regex classifiers)
- Repo hygiene: `allcode/`, `search_results.txt`, stray `.backup` files; move
  `get-shit-done/` and `graphify-out/` (third-party clones) out of the repo;
  move `eng.traineddata` into a data dir.

Empty stubs (`uia.js`, `terminal/execute.js`, `filesystem/*`) stay empty until
their phase — no point pretending.

---

## 4. Target architecture (the thin loop)

This is the browser-use / Operator pattern, adapted to your cloud/client split:

```
┌────────────── CLOUD (brain, Render) ──────────────┐
│ connectors: telegram / cli / (later voice)         │
│ router: chat | research | agent                    │
│                                                    │
│ AGENT LOOP (per goal, max ~25 steps):              │
│   1. snapshot ← client                             │
│   2. ONE LLM call:                                 │
│      in:  goal + memory + step history             │
│           + compact snapshot (numbered elements)   │
│      out: { thought, action } |                    │
│           { done, answer } | { ask_human, q }      │
│   3. send action → client, append result → history │
│   guards: max steps, same-action-3x → forced       │
│           alternative, ask_human escalation        │
└──────────────────────┬─────────────────────────────┘
                       │ WS: {requestId, action} / {requestId, result, snapshot}
┌──────────────────────┴────────── CLIENT (hands) ───┐
│ Playwright (now) → real Chrome channel + profiles  │
│ snapshot(): url, title, tabs, page text (trimmed), │
│   numbered interactive elements from ARIA tree     │
│   (OCR fallback only if ARIA is empty)             │
│ actions: navigate, click(id), type(id,text,enter?),│
│   press_key, scroll, new_tab/switch/close, back,   │
│   refresh, wait, done-report                       │
└────────────────────────────────────────────────────┘
```

Key principles:

1. **The LLM sees everything, decides everything.** No candidate pre-generation, no
   post-hoc matching, no heuristic verification gate. If the model says click [12],
   we click [12]. The snapshot must therefore be *complete* (no slicing away inputs —
   compress by trimming text, not by dropping interactive elements).
2. **History in the prompt, not a "world model."** Each step's entry: action taken,
   success/fail, URL change. The model does its own loop detection when it can see
   its own history ("I already clicked this twice").
3. **Verification = the model saying `done` + one confirm pass.** Not regex on URLs.
4. **Every action returns honest results.** Click either moved the page or didn't;
   report both the result and the fresh snapshot in one round trip.
5. **~1 LLM call per step** (vs. 3–6 now). 10-step task ≈ 10–15 calls. Groq's free
   llama-3.3-70b tier handles this; the provider chain stays model-agnostic so you
   can point OpenRouter at a stronger model (big reliability lever) without code
   changes.

---

## 5. Phased roadmap

### Phase 0 — Checkpoint & hygiene (half a day)
- Commit the current working tree (3,800 uncommitted lines incl. ariaReader/tests).
- Repo cleanup from §3 hygiene list. Fix `.gitignore` (missing trailing newline).
- Tag it `pre-rebuild` so nothing is ever lost.

### Phase 1 — Browser Operator core (the big one; ~everything depends on it)
1. **Protocol hardening**: `requestId` on every message, 30 s timeout +
   error result on `executePlanRemotely`, client auto-reconnect w/ backoff,
   shared-secret auth (env `CLIENT_SECRET` already exists).
2. **Snapshot v2 (client)**: one function returning
   `{url, title, tabs, elements[], text, quality}` — elements numbered from the ARIA
   tree with registry-backed locators (build on the new `ariaReader.js`); include
   **all** interactive elements (compress labels, never slice inputs); OCR fallback
   only when ARIA count ≈ 0.
3. **Thin agent loop (cloud)**: new `agentLoop` per §4. Single system prompt.
   Structured JSON out. Step history. Guards. `ask_human` wired to existing
   human-loop bus.
4. **Delete legacy** (§3) once the new loop passes benchmarks.
5. **Benchmark harness** (extend `cloud/src/eval/`): scripted goals, pass/fail
   assertions, run via `npm run bench`:
   - "open youtube and play a lofi music video"
   - "go to github and search for the react repository, open it"
   - "open leetcode problem 112"
   - "open the LeetCode 150 study plan"
   - "search google for react documentation and open the official docs"
   - "open youtube in a new tab and search for react tutorials"
   - multi-goal: "open react docs, and play a react video on youtube"
   - "go to wikipedia and tell me when React was first released" (extraction)
   - "open github trending and list the top 3 repos" (extraction)
   - "open chatgpt.com in a new tab"
   **Gate: ≥8/10 pass before Phase 2.**

### Phase 2 — Real Chrome, profiles, multi-goal
- `channel: "chrome"` (or Brave/Opera via executablePath) + persistent context.
- Profile support: launch with `--profile-directory="Profile N"`; map friendly names
  ("first profile") → directories; action `open_in_profile`.
- New-window support alongside new-tab.
- Multi-goal decomposition: one cheap LLM call splits "do A and B and C" into
  sequential/parallel tasks; loop runs each (this replaces the old sub-objective
  machinery — tasks are user-visible units, not micro-steps).

### Phase 3 — Telegram polish + memory
- Live status streaming to Telegram ("step 3: typed 'lofi' into search…").
- Memory: keep pg store; retrieval via LLM-filtered recall over recent + keyword
  matches (embeddings only if needed later). Inject relevant memories into the loop
  prompt.

### Phase 4 — Desktop automation (Windows)
- Real implementations for the empty stubs, kept deliberately small:
  open/close/focus apps (PowerShell + `shell:AppsFolder` already half-works),
  window management, terminal execution (with confirmation guard), filesystem
  read/write (guarded paths). Same thin-loop pattern: snapshot = window list +
  focused window UIA text; the LLM decides.

### Phase 5 — Voice + Companion mode
- STT/TTS on a 1–1.5 GB client is the constraint: recommend cloud STT
  (Groq hosts whisper-large-v3 — same API key) + local playback of cloud TTS, or
  small local whisper.cpp if offline matters. Wake-word later.
- Companion personalities = a personality layer on the chat prompt + per-user
  config in pg. Cheap to build once the loop is solid; do it after, not before.

### Phase 6 — Hosting
- Cloud → Render (WS server already binds a port; add health endpoint).
- Client stays a small always-on process; auto-reconnect from Phase 1 makes this
  safe.

---

## 6. Working agreements (to avoid the last 100 hours repeating)

1. **No new heuristics for reasoning.** If the agent picks wrong, fix the *prompt or
   the snapshot*, never add a regex.
2. **Benchmarks are the only truth.** No "readiness %" docs; a change lands only if
   the benchmark pass-rate doesn't drop.
3. **Every element visible.** Compression trims text, never interactive elements.
4. **One honest result per action.** No fabricated pageState stubs.
5. **Commit at every green benchmark run.**

---

## 7. Immediate next steps

1. Phase 0 checkpoint commit + hygiene.
2. Phase 1.1 protocol hardening (small, unblocks everything).
3. Phase 1.2 snapshot v2.
4. Phase 1.3 thin loop → first benchmark run → iterate on prompt until ≥8/10.
