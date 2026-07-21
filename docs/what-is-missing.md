# What is missing

An honest assessment of the distance between Kairos today and the assistants it is measured against — Claude's computer-use agents, OpenAI Operator, browser-use, Cowork-style multi-agent systems. Written before desktop automation, because most of what follows matters more than desktop automation and some of it must exist first.

The rule from `architecture.md` still governs everything here: **if the agent picks wrong, fix the prompt or the snapshot. Never add a regex.** Several gaps below look like they want heuristics. They do not.

## Where Kairos actually stands

Honest version, no rounding up.

**Genuinely strong.** The core loop is architecturally correct — one LLM call decides, code only executes. That is the same shape as Operator and browser-use, and it is the thing the previous rebuild got wrong for ~100 hours. Real browsers with real profiles, not a headless toy. The secrets split is better than most hobby projects: the model and the cloud only ever see `{{secret:name}}`, substitution happens on the laptop at typing time. Voice is benchmark-driven rather than doc-driven — the model and quantization choices came from measuring this specific CPU, and the fp16-over-q8 finding is the kind of thing most people get wrong. 420 tests.

**Adequate.** Memory (Postgres with local mirror and a replay queue). Companion layer — personas, episodic memory, mood, a deterministic crisis gate. Cancellation and reconnect. Observability, as of `/status` and `/last`.

**Weak or absent.** Everything in the next section.

## The honest comparison

| | Kairos | The systems it is compared to |
|---|---|---|
| Decision architecture | LLM-first, no heuristics | same |
| Browser control | real profiles, human-like input | comparable, often better recovery |
| Regression safety | **none that runs** | eval suites gating every change |
| Planning | reactive, step by step | explicit decomposition and replanning |
| Concurrency | one goal, serially | parallel subagents |
| Files and artifacts | **cannot** read a PDF or produce a document | central capability |
| Approval on risky actions | **none** | confirmation before consequential acts |
| Proactivity | none | scheduled and triggered work |
| Cost accounting | estimated from string length | measured per call |
| Model quality | free tier | frontier |

The gap is not mostly in the browser layer. It is in everything around it.

## Gap 1 — nothing stops a regression

This is the most important item in the document.

`cloud/benchmark/` exists: 10 real tasks, a runner, stored results. It scored 9/10 on 2026-07-18. It has not run since — and the entire voice stack, the cancellation work, the tone plumbing, the OCR fix and the routing refactor all landed after that date. Nobody knows what those did to task success.

The reason it does not run is structural, not lazy: **the runner requires a human.** It asks you to adjudicate each task (`humanVerdict`) and to answer any `ask_human` prompt by hand. A harness that needs a person present is a harness that runs approximately never.

There is a second, subtler problem. The unit tests are fast and green, but the thing they mostly cannot catch is the thing most likely to break: a prompt edit that changes model behaviour. `prompt.js` is described in `architecture.md` as "the main lever on behavior", and it is the least-tested file in the repository. Every prompt change today is shipped on vibes.

**What to build.** An offline eval that needs no browser, no network and no human, by recording and replaying. Capture real goal traces — the loop already produces exactly the right data structure, and `trace.js` now keeps the last one — then replay recorded observations against the live prompt and assert the model still picks sane actions. Score it. Fail the build when the score drops.

That gives you the sentence every reviewer wants to hear: *"a prompt change that breaks task success cannot merge."* Right now the true answer is *"I would find out days later, by using it."*

Keep the human-in-the-loop benchmark as the slower honest check on top. Two tiers: replay on every change, live tasks weekly.

## Gap 2 — no approval before consequential actions

Kairos will type a stored password, click Send, click Buy, click Delete. Nothing pauses. `ask_human` exists but the model chooses when to use it, which means the guarantee is "usually".

This is a safety gap and it is also the first thing a serious reviewer will probe, because it is where autonomy stops being a demo and starts being a liability.

**What to build.** A consequence classifier that is *not* a regex over page text — that would violate the working agreement. Instead, make it structural: certain action types against certain contexts require an explicit confirmation turn. Submitting a form that contains a substituted secret. Any click whose accessible name matches a small, explicit, auditable set of irreversible verbs. Purchases. Deletions. The gate lives in code because it is a safety rail, exactly like the crisis gate in `care.js` — that precedent is already established and defended in the docs.

Pair it with a **dry-run mode**: narrate every action without executing. That is worth building for its own sake, and it demonstrates far better than a video.

## Gap 3 — no plan, so no recovery

The loop is purely reactive: look at the page, pick one action, repeat. That works for "open X" and breaks down on anything with dependencies, because there is no representation of what the goal decomposes into. The guards catch thrashing (same action 4×, blocked repeats) but catching thrash is not the same as recovering from it.

`roadmap.md` warns against rebuilding sub-objective machinery, and that warning is correct — the old system's sub-objectives were the failure mode. But the lesson was *"heuristics must not own the plan"*, not *"there must be no plan"*. The model can hold a plan; code must not.

**What to build.** Let the model emit an optional plan alongside its first action and carry it in the prompt as its own state, revisable at any step. No code inspects it or enforces it. When a step fails twice, the model is asked to revise the plan rather than retry blind. This stays LLM-first and it is the difference between "gets stuck" and "tries another way".

## Gap 4 — cannot handle files

No downloads, no uploads, no reading a PDF, no producing a document. For a large class of real requests — *read this paper and summarise it*, *fill this form from that spreadsheet*, *download the invoices* — Kairos cannot participate at all.

This is the single largest capability expansion available, and much of it is browser-side work that fits the existing action model cleanly: a downloads directory, `read_file`, `write_file`, and an upload path for file inputs. OCR already exists in `visionReader.js` and can be pointed at documents.

Do this **before** desktop automation. It shares most of its plumbing and delivers more.

## Gap 5 — cost and latency are guesses

`estimateTokens` divides string length by four. Providers return real usage; it is discarded. So there is no answer to "what does a goal cost" or "which model is actually worth it", and TPM pacing is built on an approximation.

Small, cheap, high-credibility: record real usage per call, attribute it to the goal, surface it in `/last`. Then the model-choice argument in `operations.md` becomes measured rather than asserted.

## Gap 6 — one thing at a time

Goals run strictly serially. Two independent requests queue. Nothing runs in the background. Any "assistant that handles things for you" framing implies concurrency, and the current architecture has a single browser and a single queue.

This is genuinely hard and should be sequenced last of the capability work. Multiple contexts, per-goal tab ownership, and a real answer to what happens when two goals want the same page. Worth designing before building.

## Gap 7 — proactivity

Nothing ever happens unless you type. `companion.md` specifies proactivity and it was never built. Scheduled goals, reminders, a morning brief, "tell me when this page changes" — all of it is downstream of a scheduler that does not exist.

Cheap to start (a durable timer that submits a goal), and it changes the felt experience more than almost anything else on this list.

## Gap 8 — known technical debt

**The ORT load-order landmine.** `kokoro-js` bundles its own `onnxruntime` against the client's newer one. Loading Kokoro before Moonshine hard-crashes the process. Nothing enforces the order except the sequence of statements in `session.start()`. npm `overrides` was tried and does not work — kokoro-js pins `^3.5.1`. Today this is luck, not design. At minimum, make the ordering explicit and asserted so a future edit cannot silently reintroduce the crash.

**Untyped actions.** Actions are duck-typed JSON. A malformed action costs a whole step and a round trip. A schema check at the boundary, with the validation error fed straight back to the model, would recover in-place.

**Traces are in memory only.** `/last` holds one trace and it dies with the process. Persisting them is a precondition for Gap 1's replay harness.

## Suggested order

Phases, sequenced by leverage and dependency rather than by appeal.

**A — Make change safe.** Persist traces. Build the offline replay eval. Wire it into the test command. *Done when a prompt edit that breaks task success fails the build.* Everything after this is safer to attempt, which is why it is first.

**B — Make autonomy trustworthy.** Dry-run mode, then the confirmation gate on consequential actions. *Done when Kairos will not spend money or send a message without an explicit yes.*

**C — Make it measurable.** Real token usage, per-goal cost and latency, surfaced in `/last`. *Done when "which model should we use" is answered from data.*

**D — Make it capable.** Files: downloads, reading documents, uploads. *Done when "summarise this PDF" works end to end.*

**E — Make it resilient.** Model-held plans and revision on repeated failure. *Done when benchmark tasks that fail today recover instead of thrashing.*

**F — Make it feel like an assistant.** Scheduling and proactivity. *Done when it does something useful you did not ask for at that moment.* ✅ shipped 2026-07-22 — `/remind`, `/scheduled`, `/unschedule`; durable timer, fires through the normal loop and gate, result pushed marked `(scheduled)`.

**G — Then desktop automation.** It inherits the safety gate from B, the file layer from D and the eval harness from A. Building it first would mean building all three again, worse, under a bigger blast radius. Desktop actions are irreversible in ways browser actions are not, and the confirmation gate is not optional there.

## What not to build

- **Regexes that interpret pages.** The working agreement exists because that path already failed once, expensively.
- **Sub-objective machinery owned by code.** Gap 3 is deliberately phrased so the model holds the plan.
- **A wake-word matcher built on a transcriber.** Settled by experiment — a general speech model renders "Kairos" as Carlos, Tylose, Thai rolls, virus. If wake gating comes back it needs a real keyword spotter (openWakeWord, porcupine).
- **Embeddings for memory recall.** `roadmap.md` sets the trigger at ~300 facts. Do not pre-empt it.
- **More free model fallbacks as a quality strategy.** They fix quota deaths, not reasoning. `provider.js` is one array entry away from a frontier model; that swap is the real lever.
