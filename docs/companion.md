# Companion Mode — Complete Guide

**Status: BUILT (2026-07-16). Voice (§6) shipped 2026-07-21. Proactivity (§7) still pending.**

Shipped: personas + `/personality` switching, conversation memory, episodic recall ("that 2am session"), mood tracking with consent controls, support mode, crisis gate, live `/` menu in CLI, command + tappable persona picker in Telegram. Storage is Postgres with JSON fallback.

Verified live — mentor vs aria on the same input:
> *"i skipped leetcode again today honestly"* → **mentor:** "What specifically stopped you? What are you doing about it?"
> *"been really tired lately"* → **mentor:** "Tired. That 2am session last night didn't help, did it?" ← episodic recall, unprompted
> *"same, tired"* → **aria:** "i hear you. maybe a quick break or some lofi will help?" ← different voice, same memory

Kairos today is a *doer*: you give it a goal, it acts, it stops. Companion mode makes it something you live with — it remembers yesterday, notices how you're doing, has a personality, and eventually talks out loud.

This document is the full spec: what it is, how the data works, how each feature is built, in what order, and what could go wrong.

---

## 1. What "good" feels like

> **You:** hey
> **Kairos:** hey. you were up till 2 grinding LeetCode contests yesterday — did you actually sleep?
> **You:** barely lol
> **Kairos:** figured. want the easy win first today, or straight back into graphs?
> **You:** graphs
> **Kairos:** *(opens NeetCode graph section)* there. go.

Three things are happening: **continuity** (it knows yesterday), **noticing** (it inferred tiredness), and **one identity** (chatting and acting are the same assistant, not two apps).

Non-goals: not a chatbot with a browser bolted on; not a productivity nag; not a therapist replacement.

---

## 2. Architecture — one brain, more context

Companion mode is **not** a second system. Same loop, same actions, same memory. What changes is what goes into the prompt and how `done.answer` is written.

```
cloud/src/companion/
  personas.js       persona definitions
  persona.js        active persona per chat, /personality switching
  conversation.js   rolling turns + summarization
  episodic.js       "what happened yesterday" — events + daily digests
  mood.js           mood inference, storage, trend
  care.js           support mode rules + crisis handling
```

Prompt assembly becomes:

```
SYSTEM = PERSONA_BLOCK + CORE_RULES
USER   = GOAL
       + MEMORIES        (facts — existing)
       + RECENT_DAYS     (episodic digests — new)
       + MOOD            (current + trend — new)
       + CONVERSATION    (rolling turns — new)
       + HISTORY         (this goal's steps — existing)
       + PAGE            (snapshot — existing, skipped on chat turns)
```

**Rule that must not break:** persona affects *wording only*. A sassy Kairos and a calm Kairos click identical buttons. Personality must never become a reliability variable.

---

## 3. The memory model — four distinct kinds

Today there's one kind (facts). Companion needs four. Keeping them separate is what makes recall feel human instead of like a database dump.

| Kind | Example | Lifetime | Store |
|---|---|---|---|
| **Facts** | `github_username: torvalds` | forever, overwritten | `kairos_facts` (exists) |
| **Episodic** | "opened LeetCode 112, struggled ~40min, gave up" | 90 days, then digest only | `kairos_events` |
| **Mood** | `2026-07-15: tired, frustrated (0.7)` | 1 year | `kairos_moods` |
| **Conversation** | last 12 turns of this chat | rolling | `kairos_conversations` |

### 3.1 Episodic memory — "yesterday you did this"

Every completed goal writes one event automatically. This is nearly free: the loop already has the goal, the steps, the outcome.

```sql
CREATE TABLE kairos_events (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL,              -- goal | chat | note
  summary TEXT NOT NULL,           -- "searched GitHub for react, opened the repo"
  detail TEXT,                     -- goal text + final answer
  success BOOLEAN,
  duration_s INT,
  tags TEXT[]                      -- ['leetcode','dsa'] — from one cheap LLM pass
);
CREATE INDEX ON kairos_events (chat_id, happened_at DESC);
```

**Writing:** in `goalManager`, after `runAgent` resolves, append an event. The `summary` is `goal` + one-line outcome — no extra LLM call needed for the common case.

**Reading — this is the important part.** Never dump raw events into the prompt; it explodes tokens and reads like a log. Instead **digest per day**:

```
RECENT_DAYS:
today: opened 3 LeetCode problems (2 solved), played lofi twice
yesterday: GitHub react research, 4 tabs of docs; LeetCode contest — didn't finish
2 days ago: quiet, just music
```

- Today's events: kept raw (they're few)
- Each past day: one LLM-summarized line, computed **once** at day rollover and cached in `kairos_digests`
- Prompt gets today + last 3 days + a weekly rollup ≈ **150 tokens**

Digest generation is a single cheap call per day, not per turn. This is what makes "you were up till 2 yesterday" possible without paying for it every message.

**Implemented (2026-07-19)** in `digest.js`: computed lazily on the first message that needs the day, cached in `kairos_digests` (Postgres) / `digests.json` (file). Quiet days (<3 events) skip the LLM and keep the raw line; if the LLM is down the raw line is cached instead — recall never degrades to nothing.

### 3.2 Mood tracking

**How mood is captured** — two sources, no guessing games:

1. **Inferred** from the user's own words. The persona prompt already reads the message; add to the reply contract an optional field:
   ```json
   {"thought":"...","action":{"type":"done","answer":"..."},
    "mood":{"label":"frustrated","confidence":0.7,"why":"said 'this is impossible' twice"}}
   ```
   Only recorded when `confidence >= 0.5`. Free — no extra call.

2. **Behavioural signals** (weak, supporting only): activity at 2–5am, many failed goals in a row, long silence then a burst. These *hint*, never conclude.

```sql
CREATE TABLE kairos_moods (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  noted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label TEXT NOT NULL,            -- tired|frustrated|happy|anxious|flat|excited|calm
  confidence REAL NOT NULL,
  why TEXT,
  source TEXT NOT NULL            -- inferred | behavioural | stated
);
```

**Using it** — the prompt gets a compact line, not a history:
```
MOOD: today tired (0.7, "said barely slept"); this week: frustrated ×3, happy ×1; trend: rougher than usual
```

**Rules that keep it from being creepy:**
- Never announce the tracking ("I've logged that you're sad" — no)
- Never diagnose. `label` is a weather report, not a condition
- Let it be wrong gracefully — if the user says "I'm fine", the stated value wins and overwrites
- `/mood` shows everything stored; `/mood off` disables collection entirely; `/forget mood` wipes it
- Mood **never** changes what actions are allowed — only tone

### 3.3 Conversation memory — two layers

**Live window**: last **14 turns** verbatim per chat.

**Long-term summary** (`summary.js`): turns that fall out of the window get folded into one running paragraph — "notes to yourself" about who they are, what they're working on, promises, running jokes. Regenerated only when ≥10 *new* turns have aged out, so it costs roughly **one cheap LLM call per 10 turns**, not per message. It runs after the reply is already sent, so it never adds latency. Each pass feeds the previous summary back in, so memory compounds instead of resetting.

Stored on `kairos_prefs.summary` with `covered_turns` marking how far it has folded. `covered_turns` counts turns *outside* the live window — getting this wrong (counting all turns) silently stops it ever summarizing again, which is exactly what the tests caught.

Failure behaviour: if the model errors or says `NOTHING`, the old summary survives. It never degrades to worse memory than it had.

Per `chat_id`, so Telegram and CLI are separate threads. ≈ 400 tokens (window) + ≈ 175 (summary) in prompt.

---

## 4. Support mode ("therapist-like") — with guardrails

You asked for it to act as a therapist. Done carefully this is genuinely valuable; done carelessly it's harmful. Here's the line.

### What it does

- **Listens first.** When you're venting, it does not offer to open a browser tab. The single biggest failure mode is an assistant that answers pain with productivity.
- **Reflects.** "So it's not the problem itself — it's that you keep almost getting it."
- **Asks instead of assumes.** "Is this a 'talk it out' or a 'distract me'?"
- **Remembers the thread.** "You said the same thing about contests last week. Pattern, or just a bad run?"
- **Knows when to shut up.** Sometimes the right reply is "that sucks. I'm here."

### What it must never do

- Diagnose ("you have anxiety") — **never**
- Give medical/medication advice — **never**
- Claim to be a therapist or a human — it's Kairos, it says so if asked
- Push positivity at real pain ("just think positive!")
- Store sensitive disclosures as facts — those go to conversation memory only, never `kairos_facts`, and never into a prompt after the topic has passed

### Crisis handling — non-negotiable

If the user expresses self-harm intent, suicidal ideation, or immediate danger, `care.js` **short-circuits the persona entirely**. No sass, no roleplay, no cleverness:

- Respond plainly and warmly; acknowledge without minimizing
- Surface real help: local emergency services, a crisis line appropriate to their region (India: Tele-MANAS **14416**, AASRA **+91-9820466726**)
- Encourage contacting someone they trust
- Do **not** attempt therapy, do **not** continue the task queue
- Never log this to episodic memory or digests

This path is deterministic code, not a prompt suggestion — a weak model must not be able to improvise around it. It is the one place where a hard rule is correct, and it does not violate working-agreement #1, because it is a **safety gate, not reasoning about a web page**.

### Mode switching

Support mode isn't a `/command` — it's the model reading the room, with one rule: **if the user is expressing feelings, do not act; respond.** If they then ask for something, act. `/personality calm` is a good pairing but not required.

---

## 5. Personalities

`/personality` lists · `/personality sassy` switches · persists per chat · default `aria`.

| id | Gender | Feel | Sample |
|---|---|---|---|
| **aria** *(default)* | woman | warm, quick, playful, competent friend | "got it — lofi's on. go be brilliant." |
| **sassy** | woman | teasing, sharp, dry; still delivers | "2am LeetCode again? bold. opening it anyway." |
| **calm** | woman | gentle, steady, unhurried | "no rush. want me to open just the first one?" |
| **nova** | man | dry, minimal, efficient | "opened. next." |

Each persona defines: `name`, `pronouns`, `tone`, `verbosity`, `humour`, `warmth`, 3–4 few-shot sample lines, and `voice` hints (§6). Persona block ≈ 120 tokens.

**Custom personas** later: `/personality new` → a few questions → generated block stored per user.

---

## 6. Voice

### STT — Moonshine (ONNX, via transformers.js)

whisper.cpp was the original plan; it needs a compiler this laptop doesn't have. Prebuilt ONNX runs everywhere, so the choice was made by benchmark instead — 10 clips, two voices, measured on the real machine:

| model | WER | speed | RAM | on silence | on noise |
|---|---|---|---|---|---|
| moonshine-tiny | 7.1% | 164ms | 413MB | `""` | `""` |
| **moonshine-base** | **6.1%** | **249ms** | **604MB** | `""` | `""` |
| whisper-tiny.en | 9.5% | 625ms | 764MB | `"you"` | `"you"` |
| whisper-base.en | 7.2% | 889ms | 971MB | `"you"` | `"Shh."` |

Moonshine beats whisper-base on accuracy at 3-5x the speed and less RAM. **base** is the default: tiny was tried first, but the wake word decided it. On five synthesized voices saying "Kairos, open my inbox", tiny caught the wake word 3/5 and base 4/5 — tiny returned *Kai rolls*, and in real use *Titos*, *Carlos*, *Thai rolls*. 85ms is worth paying to be recognized when you call her.

The last two columns still matter: on *synthetic* silence both Moonshine models emit nothing where Whisper invents `"you"` and `"Shh."`. But that result did not survive contact with a real room — on live microphone audio Moonshine cheerfully produced *"Good morning, Guy Raz"* out of fan noise. **No speech model can be trusted to stay quiet on non-speech; the audio has to be gated before it reaches the model.** See the noise gates below.

> **Quantization is a trap here.** `q8` is 5–10× *slower* than `fp32` on this Ryzen — no VNNI, so it dequantizes in software. Benchmark before assuming smaller is faster. TTS uses `fp16`; STT uses `fp32`.

```
client/src/voice/
  config.js      tunables, all env-overridable
  capture.js     ffmpeg-static + dshow → 16kHz mono PCM
  vad.js         adaptive-threshold speech edges
  prosody.js     energy/pitch/rate vs a personal baseline
  stt.js         Moonshine ONNX, lazy-loaded
  wake.js        fuzzy "Kairos" matching + follow-up window
  session.js     the loop that ties it together
  cli.js         terminal commands
  tts/           kokoro + sapi engines, playback, wav
```

Flow: `voice` toggles listening → mic 16kHz PCM → VAD finds speech edges → wake word arms it → Moonshine → text → **the same `sendGoal()` path the keyboard uses**.

### Endpointing — how she knows you stopped

No fixed listening window. A 30-second timer either cuts you off or leaves you waiting. Instead:

- **calibrated on startup** — she samples ~1.2s of your actual room before listening and sets the trigger to `ambientPeak × 1.8`. A fixed floor is not survivable: this laptop's mic idles at RMS 142 with peaks near 196, so the original hardcoded 180 sat *below* the room noise and fired on hiss. Calibration waits for real frames, not wall-clock time — ffmpeg needs ~1s to spin up, and a timed window measures nothing but silence
- **adaptive noise floor** — EMA of quiet frames; threshold is `max(floor × 3.2, calibrated)`, so a room that gets louder mid-session raises the bar too
- **debounced start** — 120ms of loud frames before it counts as speech, so clicks and keystrokes don't arm it
- **700ms hangover** — trailing silence ends the turn; long enough to think mid-sentence, short enough to feel instant
- **300ms pre-roll** — a ring buffer of the frames *before* the trigger, so the first phoneme is never clipped
- **min 280ms / max 20s** — discards clicks, caps runaway captures
- **voiced-ratio gate** — before anything reaches the speech model, the clip must actually be *pitched*. Measured on this laptop: real speech scores 0.44–0.56, the laptop's own fan scores 0.203, white noise 0.00. The gate sits at 0.30. Energy thresholds alone could not separate fan noise from speech — the fan is loud enough to cross any floor low enough to hear you — but the fan has almost no periodicity, so pitch does separate them
- **calibration is capped** — the trigger can never exceed `VOICE_MAX_FLOOR` (600). Ambient measured 142, 165, 227 and 894 across runs: model loading spins the fan up exactly when calibration runs, so an uncapped peak-based floor would occasionally leave her deaf

### Wake word — off by default, and here is why

**A general speech model cannot hear the word "Kairos."** This was settled by an acoustic loopback test: play a reference sentence through the speakers, record it back through the microphone, transcribe that.

> reference: "**Kairos**, open my inbox and check the weather for tomorrow."
> loopback&nbsp;: "**Tylose** opened my inbox and set the weather for tomorrow."

The sentence survives; only the name fails. Every observed rendering: *Tylose, Titos, Kidos, Cuddles, Carlos, Thai rolls, Kai rolls, Kai rose, Chiros, Cairo's, Hi Rose, virus*. No edit-distance rule spans that set without also matching ordinary words — the starting consonant alone ranges across K, T, Th, C, H and V. Adding variants one at a time is whack-a-mole and was abandoned.

So `requireWake` defaults to **false**: she listens and answers whatever you say. This is only safe because the noise gates above are strict — measured 0 spurious goals across 60s of silence in a room with an audible fan. `VOICE_REQUIRE_WAKE=1` restores wake-word gating for shared spaces.

`wake.js` still runs when a wake word *is* required, and still strips a recognized name off the front of a command in either mode. Keyword spotting is the correct tool for this job (openWakeWord, porcupine) — a dedicated detector trained on the word, not a transcriber asked to spell it. That is the real fix if wake-word gating ever becomes a requirement.

**Barge-in**: speaking during playback cancels it. During a 400ms grace period after she starts talking, mic frames are ignored entirely so she never hears herself; after that a *higher* threshold (6× noise floor) is required, so only deliberate interruption cuts her off — and the interrupting words are kept, not discarded.

### TTS — personality in the voice

Flat TTS kills the persona. So the persona emits **delivery hints** inline, stripped/translated before audio:

```
"Yeah— [pause:300] I opened YouTube. [smile] Lofi's playing. Anything else?"
```

| Tag | Effect |
|---|---|
| `[pause:ms]` | inserted silence / SSML `<break>` |
| `[smile]` | brighter pitch + slightly faster |
| `[soft]` | quieter, slower |
| `[fast]` | rushed, excited |
| `…` `—` | natural micro-pauses (kept, never stripped) |

`markup.js` parses → segments with per-segment rate/pitch/volume → engine. If parsing fails, strip all tags and speak plainly — **a bad tag must never break speech**.

**Engine: Kokoro-82M (ONNX) `fp16`**, with Windows SAPI as fallback. Piper was the original pick but needs a build toolchain; `kokoro-js` is prebuilt and sounds better. Measured on this laptop:

| dtype | speed (RTF) | RAM |
|---|---|---|
| **fp16** | **0.42** | **479MB** |
| q4f16 | 0.47 | 502MB |
| q4 | 0.52 | 678MB |
| fp32 | 0.60 | 727MB |
| q8 | 2.84 | 403MB |

RTF < 1 means synthesis outruns playback. Segments are **rendered one ahead while the current one plays**, so there's no gap between sentences — but only one synthesis runs at a time, since two in parallel just contend for CPU and delay the first sound.

Persona → voice id + baseline rate/pitch, all five verified present in the model:

| persona | voice |
|---|---|
| aria | `af_heart` |
| zara | `af_bella` |
| marcus | `am_michael` |
| willow | `af_nicole` |
| nova | `am_adam` |

The cloud pushes a `persona` message on connect and whenever it changes, so the voice follows `/personality` without a restart.

### Writing for the ear

A reply written for a screen sounds like a machine when spoken — bulleted lists, markdown, raw urls read character by character. The client sends `{type:"voice_mode", on}` when voice starts and stops, and the cloud appends `VOICE_RULES` to the system prompt **only while it is on**, so typed sessions are never polluted: no lists, no markdown, short sentences, site names instead of urls, numbers spoken naturally, and delivery hints used sparingly.

### Reading text out loud

`spoken.js` rewrites a reply for the ear before it reaches the voice, because the model still sometimes writes for a screen and a symbol read literally is instantly robotic. `-60 °C` becomes "minus 60 degrees celsius", `12%` becomes "12 percent", a url becomes the site name ("I opened youtube for you"), markdown emphasis and bullets are flattened into sentences, and typographic quotes, dashes and non-breaking spaces are folded to plain ones. An ellipsis is deliberately kept — the voice reads it as a pause.

### Persona voices

Each persona maps to a Kokoro voice plus rate and pitch. Two bugs hid this for a while:

- the cloud sends `persona` on register, *before* the models finish loading, and the client dropped it whenever the session did not exist yet — so the session always built with Aria's voice no matter who was active
- **Kokoro ignores pitch entirely.** It accepts only `speed`. Every persona's pitch setting did nothing. Generating at `rate / pitch` and resampling by `pitch` gives real pitch control at constant tempo — Marcus lands at 129Hz against Aria's 141Hz.

### Emotion

A dedicated speech-emotion model costs RAM the budget can't spare for what it returns. Instead `prosody.js` measures energy, autocorrelation pitch, speech rate and pause ratio, and compares them against a **rolling baseline of how you normally sound** — absolute pitch says nothing, deviation from your own norm says a lot. It emits hints like *"quieter than usual, slower than usual"* appended to the goal, which compose with the word-based mood inference the prompt already does. Near-zero RAM, no extra model.

---

## 7. Proactivity (later, opt-in, easy to hate)

Once episodic + mood exist, Kairos *could* speak first: a morning digest, "you said you'd finish that roadmap", noticing a 3-day slump.

Rules: **opt-in only** (`/proactive on`), max 1–2/day, never during focus hours, always killable with one word. Get this wrong and it becomes Clippy. Ship it last, behind a flag.

---

## 8. Build order

Each step is independently useful and testable. **Text before voice** — if the personality isn't good in writing, voice just makes bad writing louder.

| # | Step | Status |
|---|---|---|
| 1 | `personas.js` + persona block in prompt | ✅ |
| 2 | conversation memory — rolling turns + long-term summary | ✅ |
| 3 | `/personality` switching, persisted per chat | ✅ |
| 4 | `kairos_events` writes + day-grouped recall | ✅ |
| 5 | Mood inference + `/mood`, `/mood off`, `/mood clear` | ✅ |
| 6 | `care.js` — support mode + crisis gate | ✅ |
| 7 | TTS + markup | next |
| 8 | STT + wake word + animation | next |
| 9 | Barge-in + polish | next |
| 10 | Proactivity behind `/proactive` | last |

### Bugs this build caught (all fixed)

- **Crisis gate missed "cutting myself"** — the pattern matched only "cut myself". Safety-critical; tests now cover tense variants.
- **Mood reported backwards** — `loadMoods` returned newest-first while `formatMood` read newest-last, so it announced your *oldest* mood as current.
- **It answered the wrong message** — saying "hey" got a reply about yesterday's LeetCode, because the current message sat buried at the top of the prompt and was also duplicated into CONVERSATION. Current message now goes last, and the turn is recorded after context is built.
- **`ask_human` used for chatting** — froze the goal for 5 minutes waiting on a conversational follow-up. It is now explicitly task-blocked-only; questions go in `done.answer` and your next message answers them.

### Commands

`/personality [name]` · `/mood [on|off|clear]` · `/memory` · `/recent` · `/about` · `/forget <key|chat|moods|all>` · `/help`

CLI shows them live as you type `/` — arrow keys, tab to complete, no Enter needed. Telegram registers them natively and `/personality` opens a tappable picker.

---

## 9. Budgets

**Tokens/turn** (chat, no page snapshot):

| Part | ~Tokens |
|---|---|
| Core rules + persona | 1100 |
| Facts | 100 |
| Recent days digest | 150 |
| Mood line | 40 |
| Conversation (12 turns + summary) | 400 |
| **Total** | **~1800** — cheaper than a browser step |

Browser steps additionally carry the snapshot (~1100), so a companion browser turn ≈ 2900. Watch this: the free-tier daily cap is the real limit (see `operations.md`).

**Client RAM**

| | RAM |
|---|---|
| Moonshine-tiny `fp32` + Kokoro `fp16` + onnxruntime + Node | ~855MB measured, both models resident |
| Chromium | ~400–600MB |
| **Total** | **~1.3–1.5GB** — inside the 1.5–2GB budget |

Measured, not estimated: a live 10s session with both models loaded sat at 855MB RSS. Models load lazily on `voice`, so text-only sessions stay at ~80MB.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Personality degrades reliability | persona touches wording only; browser rules live in core prompt; benchmark must still pass with every persona |
| Mood tracking feels creepy | never announce it, `/mood` transparency, `/mood off`, stated overrides inferred |
| Therapist mode causes harm | hard crisis gate in code, never diagnose, real helplines, no persona in crisis |
| Token cost per turn doubles | digests not raw events; cache daily; skip snapshot on chat turns |
| Weak model breaks character | personas are few-shot heavy; **a better model helps here too** (see `roadmap.md`) |
| Voice tags leak into text output | strip tags for text connectors; only TTS sees them |
| Sensitive disclosures persisted | conversation memory only, never facts, never digests |

---

## 11. Open decisions

1. ~~TTS engine — benchmark Piper vs Edge-TTS~~ **Resolved: Kokoro-82M `fp16`**, SAPI fallback (2026-07-21)
2. ~~Wake word — rolling-buffer STT vs porcupine~~ **Resolved: fuzzy match on the STT transcript**, no extra model (2026-07-21)
3. Whether `aria` should have a *name* the user picks
4. ~~Do digests run at local midnight, or lazily?~~ **Resolved: lazy**, on the first message that needs the day (shipped 2026-07-19)
