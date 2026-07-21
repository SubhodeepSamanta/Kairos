# Roadmap

## Done

**Phase 0 — hygiene.** Junk purged, comments stripped, 400–500 line cap enforced, `pre-rebuild` tag saved.

**Phase 1 — LLM-first operator.** Thin loop replaced ~10k lines of heuristics. Protocol v2 (auth, requestId, timeouts). Memory, secrets vault, human-in-the-loop, web search. Verified 7/10 on the benchmark.

**Phase 2 — real browsers + robustness.**
- Real Chrome / Brave / Edge via persistent context; profiles by name, email, directory, or ordinal
- Human-like interaction (mouse paths, per-char typing, chunked scroll, think-time)
- Token cuts: system prompt 1832 → 949 tokens, snapshot ~1663 → ~1243 on heavy pages; TPM pacing
- Postgres memory with JSON fallback; fixed a pool crash that would have killed the Render deploy
- Guard: an already-successful action can't be re-run
- 84 tests incl. simulated-browser suite

## Next

### Phase 2b — multi-goal ✅ done
`new_window` shipped alongside `new_tab`; prompt tells the model to track every part of a multi-part goal and only finish when all are complete. Sub-objective machinery deliberately **not** rebuilt — that was the old failure mode; the model tracks parts in history.

### Phase 3 — Telegram + memory polish ✅ mostly done
`/memory`, `/forget <key|chat|moods|all>`, `/recent` and `/about` all shipped. `/status` and `/last` were added later for observability — uptime and running commit, whether the laptop is connected, which models are resting, and a step-by-step replay of the last goal.

Still open: per-step detail in the streaming Telegram status ("typed 'lofi' into search").

Recall: current keyword+recency filter is fine to ~300 facts. Only add embeddings if that breaks.

### Proactivity — ✅ shipped 2026-07-22
`/remind <when> <what>`, `/scheduled`, `/unschedule`. Durable timer submits a real goal through the normal loop and safety gate; result is pushed marked `(scheduled)`. Was listed under Phase 4 as unbuilt; the gap analysis in `what-is-missing.md` promoted it because it changes the felt experience more than almost anything else and is cheap. Full detail in `architecture.md` §"Doing things later".

### Phase 4 — Companion mode
Full spec in **`companion.md`** — personas, episodic memory ("yesterday you did X"), mood tracking, support/therapist mode with a hard crisis gate, proactivity. Build **before** voice.

### Phase 5 — Voice (STT/TTS) — **shipped 2026-07-21**
Covered in `companion.md` §6 — Moonshine-tiny for STT, Kokoro-82M `fp16` for TTS, `[pause:300]`/`[smile]` delivery markup so the voice carries the persona. Voice is a transport for companion mode, not a separate product.

Both models were chosen by benchmark on the actual laptop, not from the docs: whisper.cpp and Piper both need a build toolchain this machine lacks, and Whisper hallucinates words on silence where Moonshine stays quiet. `voice` in the terminal turns it on. ~855MB with both models resident.

### Before Phase 6 — read `what-is-missing.md`

An honest gap analysis against the assistants Kairos is measured against, with phases A–G. The short version: an eval that runs unattended, an approval gate on consequential actions, real cost accounting, and file handling all matter more than desktop automation — and desktop automation inherits its safety rails from them, so building it first means building them twice.

### Phase 6 — Desktop automation
The stubs were deleted in Phase 0 (they were empty). Rebuild as real actions: `open_app`, `focus_window`, `type_into_app`, file ops. Same rule as the browser — LLM decides, code executes. Windows UIA via PowerShell or a native binding.

### Phase 7 — Hosting
Cloud → Render. Needs: `DATABASE_URL` (already Postgres), `PORT` from env (done), keep-alive ping, and a public WS URL for the client's `CLOUD_URL`. Client stays on the laptop — it must, since it owns the browser and secrets.

## Model quality — mostly closed (2026-07-16)

The old bottleneck was llama-3.3-70b. Benchmarking 13 free models on real Kairos decisions found **`groq/openai/gpt-oss-120b` scores 8/8 at 807ms** — it is now primary, rotating with llama-4-scout. Full table in `operations.md`.

Measured effect: "open github.com in brave" went from an infinite click-loop to **2 steps**; the weather goal passed for the first time. No paid key needed.

**News extraction — fixed (2026-07-16).** `fetchPageText` now auto-discovers a page's RSS/Atom feed and uses it when the HTML renders thin (JS-only sites), parses feeds passed directly, and throws a useful error instead of returning nothing when a page is truly unreadable — so the model moves to another source or the real browser instead of handing you links. Verified live: "top 5 tech news headlines today" returns real headlines with timestamps.

`provider.js` is model-agnostic — one entry in the providers array swaps it. Ranked by leverage:
1. **Better model** (Claude Sonnet / GPT-4o) — biggest single jump in reliability
2. More free fallback keys (Gemini, Cerebras) — fixes quota deaths, not smarts
3. Prompt tuning — real but diminishing returns

Everything else is built to be ready for that swap.
