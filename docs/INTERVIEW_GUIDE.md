# Kairos — Interview Guide

A complete, code-grounded reference for presenting this project: the pitch, a demo
script, the architecture explained subsystem by subsystem, likely interview
questions with strong answers, the real bugs I hit and how I fixed them, the design
tradeoffs, and the roadmap.

> How to use this: read it end to end once so the *system* lives in your head, then
> re-read Sections 6–8 the night before. In the room, don't recite — explain the
> **decision** and the **tradeoff**. The thing that reads as "I built this" is being
> able to say *why* it's built this way and *what broke* before it worked.

---

## 1. The 60-second pitch

> "Kairos is a voice-driven personal assistant that actually operates my computer —
> it drives my real browser and native Windows apps, not a sandbox. I talk to it from
> a terminal or Telegram; it decides what to do with an LLM and carries it out:
> searches, opens sites, fills forms, does calculations, takes notes. It's split into
> two processes — a **cloud 'brain'** that holds the LLM reasoning loop and memory,
> and a **local 'client'** that owns the browser and my passwords and never lets them
> leave the machine. The interesting engineering is in three places: an **LLM-first
> agent loop** that decides one action at a time against a live snapshot of the
> screen; a **provider-failover layer** that keeps it running on free LLM tiers
> despite rate limits; and a **safety model** where the assistant pauses for
> confirmation before anything irreversible — spending money, sending messages,
> deleting — and where secrets are never exposed to the model at all."

Then stop and let them ask. Every clause above is a thread they can pull, and you
have a whole section below for each.

---

## 2. What to demo (and in what order)

Pick the path that survives a live network. Order matters — each step raises the stakes.

1. **A plain question** — "what's the weather?" → shows it answers directly, no browser,
   when no tool is needed. (Proves it isn't just a browser macro.)
2. **A calculation on a native app** — *"open the calculator and add 472 and 32."*
   Shows desktop control end to end: it launches the app, reads its accessibility
   tree, types the expression, and reads back the real on-screen result (**504**).
   This is the most reliable "wow" because it's fast and self-contained.
3. **A research question** — *"what's the best budget sunscreen?"* Shows it searching,
   reading multiple pages, and synthesising — not parroting the first link.
4. **A note** — *"open notepad and write that I have an interview tomorrow."* Shows
   text entry into a real app.
5. **The safety gate** — try something that would spend or send. It **stops and asks**.
   This is the line that separates a toy from something you'd trust. Show it on purpose.
6. **Voice** — do one of the above hands-free to show the STT/TTS loop and barge-in
   (talk over it and it stops).

**Have a fallback.** If the network is flaky, the calculator + notepad path needs no
internet for the desktop part (the LLM call still does, so keep the phone hotspot ready).

**What to say while it runs:** narrate the *loop* — "right now the client just read the
screen into a list of numbered elements, sent that to the brain, the brain picked one
action, and it'll re-read the screen before the next decision." That sentence alone
signals you understand it.

---

## 3. Architecture at a glance

```
 Telegram / CLI ──WebSocket──►  CLOUD (brain)  ──WebSocket──►  CLIENT (hands)
   connector                         │                              │
                              LLM loop + memory              Playwright (real browser)
                              web search                     Windows UI Automation
                              safety gate                    voice (STT/TTS)
                              Postgres (optional)            secrets vault (local only)
```

**Two independent Node processes, two npm packages** (`cloud/`, `client/`), talking
over a WebSocket. This split is the single most important design decision, so be ready
to defend it (Section 6, Q1).

- **Cloud = decides.** The LLM reasoning loop, long-term memory, web search, the
  safety gate, the persona/companion layer, scheduling. Can run on a server (Render)
  or on the same laptop.
- **Client = acts.** Owns Playwright and the real browser, the Windows automation
  bridge, the microphone and speakers, and — critically — the password vault.
  **Secrets never leave this process.**

**Data flow of one command:**
1. Connector (CLI or Telegram) sends `{type:"goal", goal:"..."}` to the cloud.
2. Cloud's goal manager runs the agent loop. Each iteration it builds a prompt
   (memory + history + a text snapshot of the screen) and asks the LLM for **one**
   JSON action.
3. Cloud validates the action, runs the safety gate, then sends
   `{type:"execute", requestId, action}` to the client.
4. Client executes it against the browser/desktop, **re-reads the screen**, and returns
   an observation keyed by the same `requestId`.
5. Loop repeats until the LLM emits `done`. The final answer goes back to the connector
   (and is spoken if voice is on).

---

## 4. Code-by-code walkthrough

This is the "how did you implement X" section. Each subsystem: what it does, the key
file(s), and the design point to make.

### 4.1 The agent loop — `cloud/src/agent/loop/agentLoop.js`

The heart. It's a **perceive → decide → act** loop, LLM-first.

- **Perceive:** `buildStepPrompt()` (`prompt.js`) assembles the user prompt from
  memories, the rolling history of this turn, and a **text snapshot** of the current
  surface (browser page or desktop window) where every actionable element has a
  numeric id.
- **Decide:** `askLLMJson()` returns exactly one action, e.g.
  `{"thought":"press equals","action":{"type":"click","id":42}}`.
- **Act:** the action is mapped to a client action via the `BROWSER_ACTIONS` table,
  gated for consequences, and dispatched. After any state-changing action the client
  re-reads the screen, so **element ids are never stale** — that's why the model can
  safely refer to "id 42."

Design points to make:
- **One action per turn, not a plan up front.** The model can't see the future DOM, so
  committing to a multi-step plan is brittle. Deciding one step against the *current*
  screen and re-observing is how real agents stay robust. (There's an optional `plan`
  field the model can revise, but it's advisory, not executed blindly.)
- **Loop guards.** Repeated-action detection (`repeatCounts`), already-succeeded
  detection (`succeededResults`), a wander/revisit guard for research, tab-open caps,
  and a hard `MAX_STEPS`/`MAX_LLM_CALLS`. These stop the classic agent failure mode:
  spinning forever. I added several of these *after* watching it loop (Section 7).
- **`activeSurface`** tracks whether we're driving the browser or the desktop, and the
  loop swaps the snapshot accordingly. It also retargets a stray browser `click` to a
  desktop `click_element` while the desktop is active — two near-identical action names
  should never hit the wrong surface.

### 4.2 The prompt — `cloud/src/agent/prompt.js`

`SYSTEM_PROMPT` is the constitution: the action vocabulary and ~25 numbered rules
(when to use the real browser vs. just open a tab, never put a password in text,
feelings-first for emotional messages, etc.). Two things to highlight:

- **It's a budget-managed asset.** The base prompt + persona + heaviest step must stay
  under a token ceiling (~3350) because the free models have tight per-minute limits.
  Voice and desktop guidance are **conditional appended blocks** (`VOICE_RULES`,
  `DESKTOP_RULES`) so they don't cost tokens (or perturb the offline eval) when not in
  use. Being able to say "the prompt is engineered against a token budget" is a strong
  signal.
- **The rules encode hard-won behavior**, e.g. "web_search returns only titles+URLs —
  never hand those back as the answer; fetch a real page and answer from its content."
  That rule exists because early on it *did* answer from a snippet (Section 7).

### 4.3 LLM provider layer — `cloud/src/llm/provider.js`, `models.js`

This is where a lot of the "runs reliably on free tiers" engineering lives.

- **A ranked pool:** two PRIMARY models (rotated for load-spreading) then a BACKUP
  chain across Groq / OpenRouter / NVIDIA. Free tiers rate-limit aggressively, so a
  single provider isn't enough.
- **A sliding-window token limiter** (`TPM_LIMIT`, default 10k/min): before a call it
  checks each model's tokens used in the last 60 s and picks one with headroom; if all
  are saturated it computes the soonest one to free up and waits exactly that long.
- **Per-model cooldowns:** 60 s on a rate-limit, 5 s on a network error (and it downs
  the *whole provider* briefly, since one failing endpoint usually means the provider
  is unreachable), **6 h on a 404** (a decommissioned model id — a real problem with
  free tiers that rename models).
- **JSON hardening:** `parseJsonResponse` strips markdown fences, extracts the outer
  `{...}`, and retries trailing-comma repair; `askLLMJson` re-prompts once with "reply
  with ONLY valid JSON" before giving up. Small models emit prose around JSON constantly
  — this makes them usable as function-callers without native tool-calling.

Design point: **I deliberately don't use provider-native "function calling."** It's not
uniformly available across free models, and a strict JSON-object protocol I parse myself
is portable across every provider and lets me swap models freely.

### 4.4 Browser automation — `client/src/automation/browser/**`

- **Playwright** drives real Chrome/Brave/Edge via `launchPersistentContext`, so it can
  use *real logged-in profiles* (with the user's consent and the browser closed), or a
  private "Kairos" window that keeps its own logins, or a throwaway Chromium. Profile
  selection and the "already running locks the profile" logic live in `profiles.js` /
  `browser.js`, guarded by `kairosLock.js`.
- **The snapshot + registry pattern** (`actions/observation/read.js`, `elements/registry.js`)
  is the key abstraction. `readPage()` walks the accessibility/DOM, builds a compact
  text list — `[42] button "Buy now"` — and stores a map from id → real element handle.
  The LLM only ever sees ids and text; the handles stay on the client. After every
  state-changing action the executor re-reads, so ids refresh.
- Specialised readers (`ariaReader`, `buttonReader`, `inputReader`, `linkReader`,
  `frameReader`, and `visionReader` which OCRs via Tesseract when a page is canvas-drawn)
  each contribute part of the snapshot.

Design point: **snapshot-of-ids, not raw HTML or pixel coordinates.** HTML is too big for
the token budget and coordinates break on any layout shift. A semantic id list is compact,
stable across re-reads, and lets the model reason about *meaning* ("the Buy button")
rather than geometry.

### 4.5 Desktop automation — `client/src/automation/desktop/**`

Windows-first, same snapshot/registry shape as the browser so it plugs into the loop
unchanged.

- **A persistent PowerShell host** (`windows/uiaServer.js` is the embedded script;
  `windows/bridge.js` spawns and manages it) speaks **UI Automation**. I keep *one*
  long-lived process and talk to it with line-delimited JSON, request/response
  correlated by id. Spawning a PowerShell per action would cost 200–500 ms each — the
  same reason I keep one Playwright process alive.
- **Act through control patterns, not coordinates:** Invoke (click), Value (set text),
  Toggle, ExpandCollapse, SelectionItem. `windows/uia.js` normalises the raw tree
  (drops offscreen/noise, dedupes, caps) into the numbered element list; `windows/act.js`
  maps an id → element ref and invokes the right pattern.
- **Why no native binding (robotjs/nut.js)?** They need node-gyp — a C++ toolchain the
  target laptop doesn't have. Shelling out to a tool every OS already ships (PowerShell +
  UIA on Windows; the plan is `osascript`/AX on macOS, AT-SPI on Linux) needs zero build
  step. Same philosophy as using the OS speech APIs.
- **The focus subtlety** (great war story, Section 7): typing via keystrokes needs the
  target window to actually be foreground, and Windows blocks a background process from
  stealing focus — so I force it with the `AttachThreadInput` trick and read the app
  *by name* rather than trusting ambient focus. `InvokePattern` clicks are
  focus-independent; keystrokes are not — knowing that distinction is the fix.

### 4.6 Voice — `client/src/voice/**`

A full local speech loop, no cloud speech APIs.

- **Capture** (`capture.js`) pulls mic audio through `ffmpeg-static`.
- **VAD** (`vad.js`) is energy-based with a **room-calibration** step at startup
  (samples ambient noise, sets the speech floor) so it works in a noisy room.
- **STT** (`stt.js`) runs a small ASR model (Moonshine/Whisper) **on CPU via
  transformers.js** — offline, private, free. I post-process: `trimSilence` before the
  model, and `isNoiseTranscript` after, to drop "mm", single filler words, and repeated
  noise so it doesn't act on garbage.
- **TTS** (`tts/`) is **Kokoro** (a small neural voice) in fp16, with **Windows SAPI**
  as a zero-dependency fallback.
- **Barge-in** (`session.js`) is the nice bit: while it's speaking, it *learns its own
  echo* for 400 ms, then only treats sustained audio above that echo level as a real
  interruption — so it can be talked over without its own voice triggering it.

Design point (and a genuine finding): **fp16 Kokoro is faster than int8/q8 here.** On
this CPU via ONNX Runtime, the int8 quantised path was *slower* than fp32/fp16 because of
dequantisation overhead — a good example of "measure, don't assume quantisation is
always a win."

### 4.7 Memory — `cloud/src/memory/store.js`, `db.js`, `syncQueue.js`

- **Dual backend:** a local `memory.json` (atomic write-rename) that always works, plus
  **optional Postgres**. On boot it merges file → DB by `updatedAt`, then dual-writes.
- **Resilience:** if Postgres is down it falls back to the file, keeps serving, retries
  the connection every 60 s, and **queues DB writes** (`syncQueue.js`) to flush when it
  reconnects. No data loss, no hard dependency.
- **Relevance ranking** (`relevantFacts`): facts are capped (300 stored, 40 into the
  prompt). When over the prompt cap it scores each fact against the goal's keywords
  (key match weighted higher than value match) with a recency boost, and sends the top
  40. This keeps the prompt inside the token budget while surfacing what matters.

### 4.8 Secrets vault — `client/src/secrets/vault.js`

The security story. Say it crisply:

> "The LLM and the cloud **never see a password.** Secrets live only in a local
> `secrets.json` on the laptop. When the model needs to type one, it emits a
> placeholder — `{{secret:github_password}}` — and the client resolves it against the
> vault at the moment of typing (`resolveSecrets`). If it's missing, the client asks the
> user (via `ask_human` with `secret_name`), stores it locally, and the value still
> never travels to the model. Even the display is masked to `•••••`."

This is the answer to "how do you handle credentials safely" — a placeholder-substitution
boundary, resolved on the trusted side only.

### 4.9 Safety gate — `cloud/src/agent/consequence.js`

Before any action runs, `classifyConsequence` inspects the action **type + the element's
accessible label** and flags irreversible categories: **spend money, delete, send to
other people, submit a saved password**, plus desktop-specific ones (close an app with
unsaved work, a delete keystroke in a file manager). If flagged and not already approved,
the loop calls `ask_human` with a plain-English question (`confirmationQuestion`), and
`readsAsYes` interprets the reply. There's also a global **dry-run** mode that narrates
mutations without doing them.

Design point (a rule I held to): **the gate keys off action type and the visible label,
never a regex over the model's prose.** If the model picks a wrong action, the fix is the
prompt or the snapshot, not a pattern-match band-aid — that keeps the safety layer
principled and the agent's reasoning honest.

### 4.10 Transport & reconnect — `cloud/src/websocket/server.js`, `client/src/websocket/client.js`

- Two socket **roles**: a `client` (the hands) and one or more `connector`s (CLI,
  Telegram). Auth is a shared `CLIENT_SECRET`.
- Actions are request/response correlated by `requestId` with a 60 s timeout.
- **Reconnect resilience:** if the client drops mid-step, the cloud waits up to 8 s for
  it to re-register and **retries the step once** instead of failing the whole goal — so
  a brief client restart is transparent.

### 4.11 The rest, briefly

- **`goalManager.js`** — a single-flight queue: one goal at a time, others queue with a
  "(1 ahead)" notice, plus cancel. Prevents two goals fighting over one browser.
- **`companion/`** — personas (named voices/personalities), mood inference, and a
  **rolling summary/digest** so long histories compress to fit the token budget.
- **`schedule/`** — cron-like scheduled goals ("every morning tell me the weather").
- **`config/preflight.js`** — a startup check that verifies keys, ports, and browser
  availability and prints a readable report.
- **Offline eval + benchmark** (`cloud/eval`, `cloud/benchmark`) — a fixed set of
  scenarios run against a pinned model with a 90% pass gate, so a prompt change can't
  silently regress behavior.

---

## 5. The numbers to quote

Interviewers trust specifics. Keep these handy:

- **~130 source files** across two packages; **~690 tests** (client ~383, cloud ~310),
  green, run with Vitest.
- **One action per LLM call**, snapshot re-read after every state change.
- **Token ceiling ~3350** for the base step; conditional prompt blocks keep it there.
- **LLM pool:** 2 primary + 5 backup models across 3 providers; **10k tokens/min**
  sliding limiter; **60 s / 5 s / 6 h** cooldowns by failure type.
- **Desktop bridge:** one persistent PowerShell host; cold start ~670 ms, a read ~250 ms.
- **Voice:** STT model ~190 MB (Moonshine/Whisper) on CPU; Kokoro fp16 TTS ~160 MB.
- **Memory:** 300 facts stored, top 40 by relevance into the prompt, dual file+Postgres.

---

## 6. Interview Q&A — design & architecture

**Q1. Why split it into two processes instead of one app?**
Three reasons. **Security:** the browser and the password vault must stay on the user's
machine; the reasoning can run anywhere. A hard process boundary means secrets
physically cannot reach the cloud. **Deployability:** the brain can be hosted and shared
while the hands stay local per-user; the same client can even point at a hosted or a
local cloud. **Separation of concerns:** the cloud is pure decision-making and is fully
unit-testable with a mocked client; the client is pure actuation. The cost is a network
hop and reconnect handling, which I decided was worth it — and I hardened the reconnect
path so a client blip doesn't kill a goal.

**Q2. Why an LLM-first loop instead of scripted flows or RPA?**
Scripted automation breaks the moment a site changes its layout. An LLM deciding against
a live semantic snapshot adapts — it reasons about "the search box" and "a result title,"
not a brittle CSS selector. The tradeoff is nondeterminism and cost, which I manage with
loop guards, a strict action schema, and re-observation after every step.

**Q3. Why one action per turn rather than planning the whole task?**
The model can't see future page states, so a plan made up front is fiction after step
one. Deciding a single action against the *current* snapshot and then re-observing is how
you stay correct across dynamic pages. I keep an *advisory* plan the model can revise, but
nothing executes without a fresh look at the screen.

**Q4. How do you keep the model from acting on stale UI?**
The executor re-reads the surface after every state-changing action and re-numbers the
elements, so the ids in the next prompt always describe the current screen. The model is
explicitly told never to guess an id — if something's missing, scroll or read again.

**Q5. Why not use LangChain / an agent framework?**
I wanted to understand and control the loop, the token budget, and the failure handling
precisely — a framework would hide exactly the parts that were hard (provider failover,
the snapshot protocol, the safety gate). The whole loop is a few hundred readable lines,
which also makes it fully testable.

**Q6. Why a hand-rolled JSON protocol instead of native tool/function calling?**
Portability. Native tool-calling isn't uniform across the free models I rotate through.
A strict "reply with one JSON object" contract that I parse and repair myself works on
every provider identically and lets me swap models without touching the loop.

**Q7. How does it decide browser vs. desktop vs. just answering?**
The prompt gives it distinct action vocabularies and rules: a website → the browser; a
native app → the desktop bridge; a question it knows or an emotional message → answer
directly, no tools. The `activeSurface` state then routes execution and even auto-corrects
a browser-action-on-a-desktop mistake.

---

## 7. War stories — problems I hit and how I fixed them

These are the answers to "tell me about a hard bug." Tell them in first person, with the
*symptom → diagnosis → fix → how I verified*. That structure is what makes them land.

**A. Research gave vague, first-line answers.**
*Symptom:* asked for "best sunscreen," it read several pages but replied with one line
from the first post. *Diagnosis:* two causes — the loop trimmed older history to fit the
token budget, so earlier pages it had read were *gone* by the time it answered; and the
top search result was a **sponsored ad**. *Fix:* a dedicated `readings` accumulator that
keeps the last N fetched pages in full regardless of history trimming, a prompt rule to
weigh all sources, and an ad filter in the DuckDuckGo/Bing scraper. *Verified:* the top
result became a real article and answers cited multiple sources.

**B. "Play a song" looped forever clicking videos.**
*Symptom:* it kept clicking different video links without ever settling. *Diagnosis:* the
repeat-guard only caught *identical* actions; distinct clicks slipped through. *Fix:* a
visit/wander guard that counts navigations and revisits per URL and nudges, then aborts.
*Verified:* a unit test that simulates the loop and asserts it stops.

**C. The calculator returned the wrong number.**
*Symptom:* "5 + 21" gave garbage. *Diagnosis:* the calculator display has no settable
value, so typing falls back to Windows `SendKeys`, which treats `+ ^ % ( )` as *syntax* —
the `+` was swallowed as a Shift modifier. *Fix:* escape SendKeys metacharacters for
literal text (wrap each in braces). *Verified live:* `5+21 → 26`, later `472+32 → 504`.

**D. It reported mental math instead of the screen.**
*Symptom:* it said "97" while the display read "22." *Diagnosis:* it answered from its own
arithmetic, not the app. *Fix:* a prompt rule — report only the value the window shows,
and if it looks wrong, redo it, don't paper over it.

**E. Browser click on a desktop element / focus race.**
*Symptom:* a desktop calculation landed `0` and the agent used a browser `click` on a
native control. *Diagnosis:* two things — near-identical action names (`click` vs
`click_element`) and, deeper, `read_desktop` was reading whatever window was *actually*
foreground (often the IDE), because Windows blocks a background process from stealing
focus. *Fix:* while the desktop is active, retarget stray browser actions to their desktop
equivalents; and read the target app *by name*, forcing it foreground with
`AttachThreadInput` before reading or typing. *Key insight:* `InvokePattern` clicks are
focus-independent (they always worked); keystrokes are not. *Verified live* from behind
the IDE.

**F. A client restart killed the whole goal.**
*Symptom:* "client not connected," goal failed. *Diagnosis:* `node --watch` (or any blip)
dropped the automation socket mid-step and the cloud gave up immediately. *Fix:* wait up
to 8 s for the client to re-register and retry the step once. *Verified:* a protocol test
that terminates the client mid-request, reconnects, and asserts the step completes.

**G. Earlier rounds (before this sprint):**
- **STT heard wrong words** → added `trimSilence` and noise-transcript rejection.
- **Quantisation was slower** → measured that int8 Kokoro was slower than fp16 on this
  CPU and shipped fp16.
- **Startup ordering / model-load races** → an explicit runtime-order coordinator so STT
  and TTS load in the right sequence.
- **One identity across CLI + Telegram** → merged chat identities so it's the same
  "person" everywhere.
- **Provider phantom model ids** → 404-cooldown for renamed/decommissioned free models.
- **Memory prune left orphan DB rows** → prune now deletes from Postgres too.

The meta-point to make: **most of these came from dogfooding — actually using it and
watching it fail — then fixing the root cause, not the symptom.** That's the story.

---

## 8. Tradeoffs & "why not X" (own these)

- **Free LLM tiers → rate limits.** Chose a failover pool + token limiter over paying;
  the cost is occasional latency when everything's saturated.
- **Nondeterministic agent.** Chose adaptability over scripted reliability; mitigated with
  loop guards, an action schema, a safety gate, and an offline eval with a pass gate.
- **Windows-first desktop.** Shipped the OS I have; the CLI-bridge design is explicitly
  cross-platform so macOS (AX) and Linux (AT-SPI) slot in behind the same actions.
- **CPU-only voice.** Private and free, at the cost of not being the most accurate STT;
  fine for command phrases, and post-processing covers the gaps.
- **Text-snapshot perception, not vision.** Cheap, token-efficient, stable; falls back to
  OCR only when a page/app draws its own UI.

Weaknesses I'd volunteer if asked (honesty reads as competence):
- End-to-end account flows (Spotify login, WhatsApp) aren't fully verified — the
  primitives work, the long journeys need more live testing.
- No formal retry/idempotency guarantee if a state-changing action half-applies before a
  disconnect (I retry once; a truly exactly-once design would need action ids on the
  client too).
- Voice accuracy degrades in very noisy rooms despite calibration.

---

## 9. Future scope

- **Cross-platform desktop:** macOS via `osascript`/AX, Linux via AT-SPI, behind the same
  action set.
- **OCR/coordinate fallback** for apps with no accessibility tree (games, canvases),
  reusing the resident Tesseract worker.
- **Desktop eval cases** so prompt changes can't silently break native-app behavior.
- **Vision model** as an optional perception layer for pages that defeat the DOM reader.
- **A local/open-weight model** option to remove the cloud dependency entirely.
- **Multi-user hosting** of the cloud with per-user client pairing and quotas.
- **Richer memory:** embeddings-based recall instead of keyword scoring.
- **Exactly-once execution** with client-side action de-duplication.

---

## 10. Owning it in the room

The best defense against "did you really build this" is genuine command of the *why*.
Three habits:

1. **Lead with the decision, not the code.** "I chose a persistent PowerShell host
   because per-action spawns cost 200–500 ms" beats reciting function names.
2. **Tell failure stories in first person.** Section 7 is your strongest material —
   symptom, diagnosis, fix, verification. Nobody memorises bugs they didn't debug.
3. **Volunteer a tradeoff or weakness before they dig for it.** Section 8. Confidence
   about limits reads as ownership.

If you can, on a whiteboard, draw the loop from Section 3 and talk through one command's
round trip. That single diagram, explained fluently, carries the whole interview.

---

## 11. Rapid-fire answers

- **"What's the hardest part?"** The provider-failover layer and the desktop focus race —
  both looked simple and weren't.
- **"How is it tested?"** ~690 Vitest tests; pure logic (parsers, the snapshot formatter,
  the safety classifier, the key translator) unit-tested; the loop tested with a mocked
  LLM and executor; an offline eval with a 90% pass gate; live smoke tests by hand.
- **"How do you handle secrets?"** Placeholders (`{{secret:name}}`) to the model; real
  values resolved only on the local client; never logged, never sent, masked in display.
- **"What if the LLM returns junk?"** JSON extraction + repair + one re-prompt; a schema
  validator; and if it keeps failing, the loop stops with an honest message.
- **"How does it not loop forever?"** Repeat/already-done/wander guards plus hard step and
  call caps.
- **"Biggest thing you'd change?"** Add exactly-once execution and finish the
  cross-platform desktop drivers.
- **"Why is it called Kairos?"** Greek for the *right, opportune moment* to act — which is
  exactly what the agent decides each turn.
```
