# Kairos Architecture

Kairos is a personal assistant that drives a real browser on your computer. You talk to it from Telegram or the CLI console; it decides what to do and does it.

## Shape

```
Telegram / CLI  ──WebSocket──►  CLOUD (brain)  ──WebSocket──►  CLIENT (hands)
                                     │                              │
                                 LLM + memory                   Playwright
                                 web search                    real Chrome/Brave/Edge
                                 Postgres                      secrets vault (local)
```

- **Cloud** — decides. Holds the LLM loop, memory, web search. Deployable to Render.
- **Client** — acts. Owns the browser and your secrets. Never leaves your laptop.
- One WebSocket carries both connector traffic (goals in, answers out) and client traffic (actions out, observations in).

## The agent loop — LLM-first

This is the core idea, and the reason the previous rebuild happened.

```
loop until done / limit:
  snapshot = last observation of the page
  decision = ONE LLM call(system prompt + goal + memories + history + snapshot)
  execute exactly what the model said
  record honest result in history
```

The model sees a complete list of interactive elements with numeric ids and picks one. There is **no code that reasons about the page** — no regex classifiers, no candidate generation, no heuristic verification. This matches how OpenAI Operator and browser-use work.

**Working agreement #1: if the agent picks wrong, fix the prompt or the snapshot. Never add a regex.**

The old system did the opposite (heuristics decided, LLM rubber-stamped) and failed for ~100 hours. Its failure mode is documented in git history at tag `pre-rebuild`.

### Actions the model can take

| Group | Actions |
|---|---|
| Browser | `navigate` `click` `type` `select_option` `press_key` `scroll` `back` `refresh` `new_tab` `switch_tab` `close_tab` `read` `wait` `screenshot` |
| User's own browser | `open_for_user{url}` — new tab in their everyday browser (their logins, their window); Kairos cannot see or control that tab. Default for plain "open X" goals |
| Browser choice | `list_browsers` `use_browser{browser,profile}` |
| Knowledge | `web_search` `fetch_page` (no browser — fast and cheap) |
| Memory | `remember{key,value}` |
| People | `ask_human{question}` · `ask_human{question,secret_name}` |
| End | `done{success,answer}` |

### Guards (safety rails, not reasoning)

- 30 steps and 45 LLM calls per goal
- Same action 4× → abort with an honest report
- An action that already succeeded cannot be re-run; the model is told to use the result it has
- Per-step LLM retry with 8s/20s/45s backoff
- Token-bucket pacing keeps us under the provider's tokens-per-minute ceiling

## Files that matter

| Path | Role |
|---|---|
| `cloud/src/agent/loop/agentLoop.js` | the loop |
| `cloud/src/agent/prompt.js` | the system prompt — **the main lever on behavior** |
| `cloud/src/agent/snapshot.js` | page → compact text the model reads |
| `cloud/src/agent/webTools.js` | DuckDuckGo → Bing fallback search, page fetch |
| `cloud/src/agent/goalManager.js` | serial goal queue |
| `cloud/src/llm/provider.js` | fallback chain + rate pacing |
| `cloud/src/memory/{store,db}.js` | facts, Postgres with JSON fallback |
| `cloud/src/websocket/server.js` | protocol v2 |
| `client/src/executor/executor.js` | one action → one observation |
| `client/src/automation/browser/browser.js` | launch/tabs, real browsers + profiles |
| `client/src/automation/browser/profiles.js` | browser + profile discovery |
| `client/src/automation/browser/humanize.js` | human-like timing/mouse/typing |
| `client/src/secrets/vault.js` | passwords, local only |

## Protocol v2

Every message authenticates with `CLIENT_SECRET`. Actions carry a `requestId`; the cloud correlates the reply and times out after 60s. If the client disconnects, pending requests reject immediately instead of hanging. Goals run one at a time through a queue.

```
connector → cloud   {type:"goal", goal:"…"}
cloud → client      {type:"execute", requestId, action}
client → cloud      {type:"result", requestId, observation}
cloud → connector   {type:"goal_status"|"human_input_request"|"goal_result"}
```

## Memory and secrets — deliberately split

| | Where | Why |
|---|---|---|
| Facts (usernames, resolved URLs, preferences) | Postgres `kairos_facts`, mirrored to `cloud/data/memory.json` | must survive Render restarts; safe to send to the LLM |
| Passwords / tokens | `client/data/secrets.json` on your laptop only | the LLM and cloud only ever see `{{secret:name}}`; the client substitutes at typing time |

Facts are injected into every prompt (relevance-filtered above 40 entries — word-boundary matches outrank substrings, key hits outrank value hits, recently-updated facts get a small boost). The model saves them itself via `remember` — e.g. after resolving Twitch once it navigates straight there next time.

Durability: every JSON file is written atomically (tmp + rename, so a crash can't corrupt it), and any Postgres write that fails while the DB is down goes into a retry queue that replays on the next successful write — the local file is always the complete copy, Postgres catches up. `/memory` shows the backend and any writes waiting to sync. Past days of episodic memory are compressed into one cached line each (`digest.js`), so the RECENT block stays ~150 tokens no matter how long you've used Kairos.

## Browsers

Plain "open X" goals go straight to **your own everyday browser** via `open_for_user` — a tab appears in the window you already have open, logged in as you. Kairos cannot see or control that tab, which is fine because nothing more was asked.

Goals that need Kairos to *act on* a page use a controlled browser, chosen automatically: your **real last-used profile** (all your logins) when that browser is fully closed; otherwise a **private Kairos window** of the same real browser (Chromium locks a profile to one process, so a running Chrome cannot be driven). The Kairos window keeps its own logins across sessions and its profile is named "Kairos" so it is recognizable. "Anonymous / incognito" requests use the isolated throwaway Chromium. Every snapshot carries a `VIA:` line so the model — and you — always know which one is active.

Profiles resolve by display name ("Kami"), account email, directory ("Profile 8"), or ordinal ("first"). If that browser is already running, a real-profile launch fails cleanly and the model asks you to close it or falls back.

## Human behaviour

Clicks hover the element with a multi-step mouse move first; typing is per-character with 35–85ms jitter; scrolling is chunked wheel events; short randomized think-time between actions. Set `HUMANIZE=false` to disable.

## Vision

OCR (`visionReader.js`, Tesseract) fires **only** when a page yields almost no accessible elements. ARIA + DOM is always the primary path. This is intentional and stays a last resort.
