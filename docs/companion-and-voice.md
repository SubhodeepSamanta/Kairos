# Companion Mode & Voice — Plan

Goal: open the laptop, talk, and it feels like a person answering — not a command parser. Voice is the transport; **the personality is the product**, so companion mode is built first.

---

# Phase 4 — Companion Mode

## The problem with today's loop

`agentLoop` is a *doer*. A greeting exits in one step with a flat sentence. A companion needs continuity ("how did the LeetCode go?"), a voice of its own, and the ability to slide between chatting and acting mid-sentence.

## Design

**One brain, two modes — not two systems.** Conversation and action share the same loop and the same memory. The persona is a prompt layer; `done.answer` is spoken in-character.

```
cloud/src/companion/
  personas.js        persona definitions (name, voice traits, speech rules, sample lines)
  conversation.js    rolling per-chat history, summarization when long
  persona.js         active persona per chat, /personality switching
```

### Conversation memory

Distinct from facts. Facts are permanent key/values; conversation is a rolling window.

- Keep last ~12 turns verbatim per chat
- Older turns → one LLM-summarized paragraph ("Subhodeep is prepping DSA, prefers lofi while working, was frustrated with LeetCode contests")
- Injected into the prompt as `CONVERSATION` alongside `MEMORIES`
- Store per chat id in Postgres (`kairos_conversations`), so Telegram and CLI keep separate threads

**Facts get promoted out of conversation**: when the model learns something durable it calls `remember` — the existing path already works.

### Personas

`/personality` lists, `/personality sassy` switches, persists per chat.

| id | Feel |
|---|---|
| `aria` *(default, woman)* | warm, quick, a bit playful. Competent friend who has your back. |
| `sassy` (woman) | teasing, sharp, dry. Still gets the job done, comments on your 2am LeetCode. |
| `calm` (woman) | gentle, steady, unhurried. Good when you're stressed. |
| `nova` (man) | dry, understated, efficient. Minimal words. |

Each persona defines: name, pronouns, tone rules, verbosity, humour level, 3–4 sample lines (few-shot), and **voice hints** for TTS (see below).

Persona shapes *only* the wording. It never changes what actions are allowed or how the browser is driven — a sassy Kairos and a calm Kairos click identical buttons. This keeps personality from becoming a reliability risk.

### Prompt shape

```
SYSTEM = PERSONA_BLOCK + CORE_RULES(existing)
USER   = GOAL + MEMORIES + CONVERSATION + HISTORY + PAGE
```

Persona block is small (~120 tokens). Chat-only turns skip the page snapshot entirely — cheap.

### Token guard

Conversation adds cost to every turn. Cap: 12 turns verbatim + 1 summary ≈ 400 tokens. Chat turns (no snapshot) land ~1.2k total — cheaper than a browser step.

---

# Phase 5 — Voice

## STT — whisper.cpp

**Why whisper.cpp, not the Python one**: single native binary, no Python runtime, `ggml-base.en` ≈ 140MB RAM. Fits the 1–1.5GB client budget. Runs on CPU fine.

```
client/src/voice/
  stt.js        whisper.cpp child process, streaming chunks
  vad.js        voice activity detection (silence → cut)
  wake.js       "Kairos" wake word
  animation.js  terminal waveform/pulse
```

Flow:
1. `/voice` in the console toggles listening
2. Mic → 16kHz PCM → VAD finds speech boundaries
3. Wake word "Kairos" arms it (else it transcribes your whole life)
4. Chunk → whisper.cpp → text → same `sendGoal()` path the keyboard uses
5. Terminal shows a live waveform while listening, spinner while thinking

Voice input is **just another connector**. It hits the identical loop — no separate code path, so everything (browser, memory, ask_human) works spoken on day one.

**Barge-in**: speaking while it talks cancels playback and starts a new turn.

## TTS — with actual personality

This is the part you cared about, and the ordinary TTS path gets it wrong: flat prosody, no pauses, robotic.

**The markup idea.** The LLM already writes `done.answer`. Let the persona also emit *delivery hints* inline, then strip/translate them before audio:

```
"Yeah— [pause:300] I opened YouTube. [smile] Lofi's playing. Anything else?"
```

| Tag | Effect |
|---|---|
| `[pause:ms]` | inserted silence / SSML `<break>` |
| `[smile]` | brightens pitch+rate for the next clause |
| `[soft]` | lower volume, slower |
| `[fast]` | rushed, excited |
| `…` `—` | natural micro-pauses (kept, not stripped) |

Pipeline: persona prompt teaches the tags → `voiceMarkup.js` parses → segments with per-segment rate/pitch → engine.

**Engine choice** (pick at Phase 5 start, benchmark on the actual laptop):

| Option | Quality | Cost | Notes |
|---|---|---|---|
| **Piper** (local, ONNX) | good | free, ~100MB | fast, offline, per-segment rate/pitch control. **Recommended default.** |
| Edge-TTS (unofficial MS) | very good | free | needs network; real SSML |
| ElevenLabs | best | paid | best emotion; use if you'll pay |
| Windows SAPI | poor | free | fallback only |

Start Piper with a warm female voice for `aria`; map each persona → voice id + baseline rate/pitch.

## Ordering

1. Personas + conversation memory (text first — prove the personality in the console)
2. `/personality` switching
3. TTS with markup (hear it)
4. STT + wake word + animation (talk to it)
5. Barge-in and polish

Text-first matters: if the personality isn't good in text, voice just makes bad writing louder.

## Resource budget (client)

| | RAM |
|---|---|
| whisper.cpp base.en | ~140MB |
| Piper + voice | ~100MB |
| Playwright/Chromium | ~400–600MB |
| Node | ~80MB |
| **Total** | **~0.9–1.1GB** — inside your 1–1.5GB target |

Load STT/TTS lazily on `/voice` so text-only sessions stay light.
