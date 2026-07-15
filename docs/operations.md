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
cd cloud && npx vitest run     # 39 tests
cd client && npx vitest run    # 45 tests
```

Browser tests use a **simulated page** (fake locators/ARIA tree) — no real Chromium, fast, deterministic. They cover the regressions that historically broke things: element slicing, ordering, disabled/invisible handling, profile resolution, humanize behaviour, token budget, secrets, protocol timeouts.

## Benchmark

```bash
cd cloud && node benchmark/run.js        # all 10 tasks
cd cloud && node benchmark/run.js 8 9 10 # specific tasks
```

Runs your real goals end to end and asks you to confirm each. Gate: **≥8/10**.

Last full run: **7/10**. Tasks 8–10 (weather / news / twitch) were blocked by exhausted free-tier quotas, not logic errors.

## Models — measured, not guessed

All free. Benchmarked 2026-07-16 on 8 real Kairos decisions (say-done-when-open, answer-from-history, ambiguity, don't-search-twice, obey-notice, …), paced to separate genuine mistakes from rate limits:

| Score | Avg | Model | Role |
|---|---|---|---|
| **8/8** | 807ms | `groq/openai/gpt-oss-120b` | **primary A** |
| 6/8 | 605ms | `groq/meta-llama/llama-4-scout-17b-16e-instruct` | **primary B** |
| 6/8 | 6.0s | `groq/qwen/qwen3-32b` | backup |
| 5/8 | 28s | `openrouter/nvidia/nemotron-3-super-120b-a12b:free` | backup (cross-provider) |
| 1/8 | 56s | `groq/llama-3.3-70b-versatile` | backup (was the old default) |
| 0/8 | 66s | `openrouter/qwen/qwen3-next-80b-a3b-instruct:free` | rejected |

Rerun anytime: the benchmark script pattern is in git history (`modelbench.tmp.js`), or just swap an entry in `provider.js` — it is model-agnostic.

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

The legacy `memories` table in Postgres is **untouched and unused** — Kairos now writes `kairos_facts`. It still contains junk from the old system including a plaintext `password: 123` row. Drop it when convenient:

```sql
DROP TABLE memories;
```
