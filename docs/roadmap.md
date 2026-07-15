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

### Phase 3 — Telegram + memory polish
- Status already streams and edits in place; add per-step detail ("typed 'lofi' into search")
- `/forget <key>`, `/memory` to inspect what it knows
- Recall: current keyword+recency filter is fine to ~300 facts. Only add embeddings if that breaks.

### Phase 4 — Companion mode
Full spec in **`companion.md`** — personas, episodic memory ("yesterday you did X"), mood tracking, support/therapist mode with a hard crisis gate, proactivity. Build **before** voice.

### Phase 5 — Voice (STT/TTS)
Covered in `companion.md` §6 — whisper.cpp for STT, Piper for TTS, `[pause:300]`/`[smile]` delivery markup so the voice carries the persona. Voice is a transport for companion mode, not a separate product.

### Phase 6 — Desktop automation
The stubs were deleted in Phase 0 (they were empty). Rebuild as real actions: `open_app`, `focus_window`, `type_into_app`, file ops. Same rule as the browser — LLM decides, code executes. Windows UIA via PowerShell or a native binding.

### Phase 7 — Hosting
Cloud → Render. Needs: `DATABASE_URL` (already Postgres), `PORT` from env (done), keep-alive ping, and a public WS URL for the client's `CLOUD_URL`. Client stays on the laptop — it must, since it owns the browser and secrets.

## The honest bottleneck

The architecture now matches Operator/browser-use. The gap to "as good as OpenAI/Claude" is **model quality**, not design.

Llama-3.3-70b on Groq free is the weak link. Observed: it re-ran an action whose result was already in its history, and needed a code guard to stop. GPT-4o / Claude Sonnet do not make that class of mistake.

`provider.js` is model-agnostic — one entry in the providers array swaps it. Ranked by leverage:
1. **Better model** (Claude Sonnet / GPT-4o) — biggest single jump in reliability
2. More free fallback keys (Gemini, Cerebras) — fixes quota deaths, not smarts
3. Prompt tuning — real but diminishing returns

Everything else is built to be ready for that swap.
