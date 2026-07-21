# Running, Testing, Troubleshooting

## Run it

```bash
# terminal 1 — brain
cd cloud && node index.js

# terminal 2 — hands
cd client && node index.js
# then type: startKairos     (opens the console you talk to)
```

Telegram works the moment the cloud is up — message the bot directly.

## Environment

`cloud/.env`

| Key | Purpose |
|---|---|
| `PORT` | WebSocket port (currently **3000**, not 8080) |
| `CLIENT_SECRET` | shared auth; must match client |
| `GROQ_API_KEY` | primary LLM |
| `OPENROUTER_API_KEY` / `NVIDIA_API_KEY` | fallbacks |
| `DATABASE_URL` | Postgres (Neon). Omit → local JSON file |
| `TELEGRAM_BOT_TOKEN` | Telegram connector |
| `LLM_TPM_LIMIT` | tokens/min pacing ceiling (default 10000) |

`client/.env`

| Key | Purpose |
|---|---|
| `CLOUD_URL` | e.g. `ws://localhost:3000` |
| `CLIENT_SECRET` | must match cloud |
| `HUMANIZE` | `false` disables human-like delays |

## Tests

```bash
cd cloud && npx vitest run     # 145 tests
cd client && npx vitest run    # 92 tests
```

Stop any live cloud/client first — a running instance shares the same Postgres and data files and causes spurious failures in two tests.

Browser tests use a **simulated page** (fake locators/ARIA tree) — no real Chromium, fast, deterministic. They cover the regressions that historically broke things: element slicing, ordering, disabled/invisible handling, profile resolution, humanize behaviour, token budget, secrets, protocol timeouts.

## Benchmark

```bash
cd cloud && npm run bench          # all 10 tasks, you adjudicate each
cd cloud && npm run bench -- 8     # one task
cd cloud && npm run bench:auto     # unattended, exits 1 below the gate
```

Runs your real goals end to end. Gate: **≥8/10**.

`bench:auto` needs no human: it takes the agent's own success flag as the verdict and auto-answers any `ask_human` from the optional `reply` field on the task. That verdict is weaker than yours — an agent can believe it succeeded when it did not — so treat auto as the regression tripwire and the attended run as the real score. Both print the delta against the previous run.

The attended-only version is why this suite went unrun from 2026-07-18 through the whole voice effort. A harness that needs a person present runs approximately never; see `what-is-missing.md`.

For a quick unattended smoke test (no confirmations — checks goals complete, not quality):

```bash
cd cloud && node e2e-check.cjs "hi kairos" "open example.com in the browser"
```

Last full run: **7/10**. Tasks 8–10 (weather / news / twitch) were blocked by exhausted free-tier quotas, not logic errors.

## Models — measured, not guessed

All free. Original benchmark 2026-07-16 on 8 real Kairos decisions. **2026-07-19: Groq decommissioned `llama-4-scout` and `qwen3-32b` (404)** — lineup rebuilt from Groq's live catalog; a 404 now puts a model in a 6-hour cooldown so a dead model can't slow every goal.

| Model | Role | Note |
|---|---|---|
| `groq/openai/gpt-oss-120b` | **primary A** | 8/8 on the decision benchmark |
| `groq/openai/gpt-oss-20b` | **primary B** | same family, separate per-model quota pool |
| `groq/qwen/qwen3.6-27b` | backup | emits `<think>` blocks; JSON extractor strips them |
| `groq/llama-3.1-8b-instant` | backup | fast, small |
| `openrouter/nvidia/nemotron-3-super-120b-a12b:free` | backup (cross-provider) | slow (28s+) but independent |
| `groq/llama-3.3-70b-versatile` | backup | 1/8 — last-ditch only |

Groq also hosts `whisper-large-v3`/`-turbo` — a free STT option for the voice phase.

Rerun anytime: the benchmark script pattern is in git history (`modelbench.tmp.js`), or just swap an entry in `provider.js` — it is model-agnostic.

## Tokens, latency and cost

Providers return a real `usage` block and it used to be thrown away. Every call now records `prompt_tokens`, `completion_tokens` and round-trip latency onto the goal's budget; `/last` reports them and marks the number `(estimated)` when a provider stayed silent.

The old estimate was `characters / 4`, which is wrong in two directions that compound. It ignores chat-template overhead, and it counts **no output at all**. Measured on a trivial call: estimate 8 tokens, actual 170 — a 21x undercount. On a full step prompt the input estimate is close, but a reasoning model's output is still invisible to it.

That matters beyond reporting, because **TPM pacing was built on that estimate**, so the rate limiter was systematically over-permissive — the likeliest cause of the 429s that appear mid-eval. Pacing now backfills each call's real total once the provider reports it.

Set `LLM_COST_PER_MTOK` to have `/last` show money. It is deliberately never computed from estimated tokens — an invented cost is worse than none.

### How the two primaries are used

**Rotation, not racing.** Calls alternate A → B → A → B. Groq rate-limits **per model** (`"rate limit reached for model X"`), so two different Groq models have separate daily pools — alternating roughly **doubles daily capacity**.

Racing both and taking the first reply would *halve* it. Since daily quota is the binding constraint, rotation is strictly better.

On failure the chain walks: other primary → backups → NVIDIA last. A model that 429s is put in a **60s cooldown** and skipped, so we stop hammering an exhausted pool.

### Quota

| Provider | Notes |
|---|---|
| Groq | ~12k TPM, ~100k TPD **per model** — hence rotation |
| OpenRouter `:free` | upstream-limited; slow (28s+) but a genuinely independent provider |
| NVIDIA | `/models` responds, but `chat/completions` **hangs indefinitely** — has never once succeeded. Kept last with a 20s timeout so it fails fast |

A step costs ~1.5–2.4k tokens (system prompt ~1150 + snapshot ~600–1250 + history). With rotation that is roughly **80–120 steps/day** free. "AI providers busy" almost always means quota, not code.

To go further: another free key (Gemini, Cerebras) as a third primary, or $5 of OpenRouter credit.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "AI providers busy, retrying…" then failure | daily quota exhausted — see above |
| `use_browser` fails, "already open" | close that browser fully (check tray), or let it use the isolated one |
| Agent loops on one element | site fights automation; it should escape via `web_search` + direct URL. If it doesn't, that's a **prompt** fix |
| Search returns nothing | DuckDuckGo bot-blocked us; Bing fallback is automatic. Both blocked → agent searches in the browser instead |
| Cloud exits on startup | Postgres cold start (Neon suspends). 25s timeout covers it; idle drops are handled |
| Client can't register | `CLIENT_SECRET` mismatch between the two `.env` files |

## Known cleanup

The legacy `memories` table from the old system (which contained a plaintext `password: 123` row) is dropped automatically on cloud startup — `connectMemoryDb` runs `DROP TABLE IF EXISTS memories` before creating the `kairos_*` tables.
