# Kairos

A personal assistant that drives a **real browser on your computer**. You talk to it
from Telegram or a terminal; it decides what to do and does it — searches, opens sites,
fills forms, reads pages back to you. It also remembers you: past sessions, preferences,
and a personality you choose.

```
Telegram / CLI  ──WebSocket──►  CLOUD (brain)  ──WebSocket──►  CLIENT (hands)
                                     │                              │
                                 LLM + memory                  Playwright
                                 web search                    real Chrome/Brave/Edge
                                 Postgres (optional)           secrets vault (local)
```

- **Cloud** decides. Holds the LLM loop, memory, and web search. Can be hosted (Render); can also run on your laptop.
- **Client** acts. Owns the browser and your passwords. Never leaves your machine.

---

## Requirements

- **Node.js 18+** (developed on 22). Check with `node --version`.
- A **free LLM API key** — [Groq](https://console.groq.com/keys) is recommended (fast, free).
- **Chrome, Brave, or Edge** installed (for driving your real browser), *or* nothing —
  Kairos falls back to a bundled throwaway Chromium.
- Optional: a Telegram bot token, a Postgres database.

---

## Setup

```bash
git clone <this-repo> kairos && cd kairos

# 1. install dependencies (two halves, installed separately)
cd cloud   && npm install && cd ..
cd client  && npm install && cd ..

# 2. download the browser the client falls back to
cd client && npx playwright install chromium && cd ..

# 3. create your config from the templates
cp cloud/.env.example  cloud/.env
cp client/.env.example client/.env
```

Then open **`cloud/.env`** and paste in at least one LLM key (e.g. `GROQ_API_KEY=...`).
Pick any long random string for `CLIENT_SECRET` and put the **same** value in
**`client/.env`**. That's the minimum — everything else is optional.

> On first run, each half prints a **preflight report**. If something required is missing,
> it tells you exactly what and how to fix it, rather than crashing with a stack trace.

---

## Run it

Two terminals:

```bash
# terminal 1 — the brain
cd cloud && node index.js

# terminal 2 — the hands
cd client && node index.js
# then type:  startKairos      (opens the console you talk to)
```

Telegram works the moment the cloud is up — just message your bot.

---

## Configuration reference

**`cloud/.env`**

| Key | Required | Purpose |
|---|---|---|
| `PORT` | no (default 3000) | WebSocket port. The client's `CLOUD_URL` must point here. |
| `CLIENT_SECRET` | recommended | Shared auth; must match the client. Blank = no auth. |
| `GROQ_API_KEY` | **one LLM key** | Primary LLM. Free: console.groq.com/keys |
| `OPENROUTER_API_KEY` | ↑ or this | Fallback LLM. openrouter.ai/keys |
| `NVIDIA_API_KEY` | optional | Extra fallback. |
| `TELEGRAM_BOT_TOKEN` | optional | Telegram connector (from @BotFather). |
| `DATABASE_URL` | optional | Postgres. Omit → local JSON under `cloud/data/`. |
| `LLM_TPM_LIMIT` | optional | Tokens/min pacing ceiling (default 10000). |

**`client/.env`**

| Key | Required | Purpose |
|---|---|---|
| `CLOUD_URL` | yes | e.g. `ws://localhost:3000`. |
| `CLIENT_SECRET` | recommended | Must match the cloud. |
| `HUMANIZE` | optional | `false` disables human-like delays. |
| `DEFAULT_BROWSER` | optional | `chrome` \| `brave` \| `edge`. |

---

## Browsers

By default Kairos opens a **private Kairos window** of your everyday browser (real
Chrome/Brave/Edge, but a separate profile that keeps its own logins and never clashes
with the browser you use daily). Log into a site once there and it stays logged in.

To use one of your **real, already-logged-in profiles**, name it — but that requires
the browser to be **fully closed** first (Chromium only lets one process own a profile).
If no supported browser is installed, Kairos uses a bundled isolated Chromium (no logins).

---

## Memory & secrets — deliberately split

| | Where | Why |
|---|---|---|
| Facts (usernames, resolved URLs, preferences) | Postgres `kairos_facts`, mirrored to `cloud/data/memory.json` | safe to send to the LLM |
| Passwords / tokens | `client/data/secrets.json` on your machine only | the cloud and LLM only ever see `{{secret:name}}` |

Both `data/` directories are gitignored. Your `.env` files are too — **never commit real keys.**

---

## Companion

Kairos has a personality and remembers you. In chat:

| Command | Does |
|---|---|
| `/personality [name]` | switch how it talks (aria, sassy, mentor, calm, nova) |
| `/mood [on\|off\|clear]` | see or control the mood read |
| `/memory` | what it remembers about you |
| `/recent` | what you did recently |
| `/about` | a snapshot of who it thinks you are |
| `/forget <key\|chat\|moods\|all>` | make it forget something |
| `/help` | list commands |

If you express distress, a hard-coded crisis gate replaces the assistant with real
helpline information — see `docs/companion.md`.

---

## Tests

```bash
cd cloud   && npx vitest run
cd client  && npx vitest run
```

Browser tests use a **simulated page** — no real Chromium, fast and deterministic.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `no LLM key configured` on cloud start | add `GROQ_API_KEY` (or another) to `cloud/.env` |
| "AI providers busy, retrying…" then failure | free-tier daily quota exhausted — add another key or wait |
| Client can't register / `auth_failed` | `CLIENT_SECRET` differs between the two `.env` files |
| `browserType.launch … Executable doesn't exist` | run `npx playwright install chromium` in `client/` |
| `use_browser` fails, "already open" | close that browser fully, or let Kairos use its private window |
| Cloud exits on startup with a DB error | Postgres cold start — retry, or omit `DATABASE_URL` to use local files |

More detail in **`docs/operations.md`** and **`docs/architecture.md`**.
