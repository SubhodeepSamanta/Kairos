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

## Token economics — read this before blaming the agent

Free tiers are the binding constraint.

| Model | TPM | TPD |
|---|---|---|
| Groq llama-3.3-70b | ~12k | ~100k |
| Groq llama-3.1-8b | higher | separate pool |
| OpenRouter `:free` | upstream-limited, unreliable |
| NVIDIA | currently times out on every call |

A step costs ~1.5–2.4k tokens (system prompt ~950 + snapshot ~600–1250 + history). So **~40–60 steps/day** on Groq free — roughly 5–10 goals. When you see "AI providers busy" or a goal dying mid-flight, that is almost always quota, not code.

Fixes, cheapest first:
1. Add another free key (Gemini, Cerebras) as a fallback provider
2. $5 OpenRouter credit → effectively removes the ceiling
3. Paid Groq tier

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
