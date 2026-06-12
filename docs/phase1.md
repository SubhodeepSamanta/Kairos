Perfect. Let's do this like an actual evaluation run instead of random testing.

We want to identify:

```text
Planner failures
Click failures
Type failures
Read UI failures
Verification failures
Replanning failures
```

---

# Batch 1 — Search Workflows

### YouTube

```text
search youtube for lofi
search youtube for minecraft
search youtube for openclaw
search youtube for ai agents
search youtube for lo fi hip hop
```

---

### GitHub

```text
search github for playwright
search github for browser use
search github for langgraph
search github for openclaw
search github for react
```

---

### Google

```text
search google for browser agents
search google for openai
search google for langchain
search google for latest ai news
search google for playwright
```

---

# Batch 2 — Navigation Understanding

These test planning.

```text
open github then go to pricing
open youtube then open trending
open github and open docs
open github and sign in page
open youtube and go home
```

---

# Batch 3 — Multi-Step Browser Tasks

These test action composition.

```text
open github and search for playwright
open youtube and search for lofi
open google and search for browser use
open github and search for langgraph
open youtube and search for minecraft
```

---

# Batch 4 — Tab Intelligence

These test state awareness.

```text
open youtube
new tab
open github
switch tab 0
open reddit
list tabs
```

Then:

```text
switch tab 1
read ui
```

Then:

```text
close tab 0
list tabs
```

---

# Batch 5 — Extraction

```text
open github
extract links
extract metadata
read ui
take screenshot
```

---

# Batch 6 — Failure Tests

These are important.

```text
click search box
click login button
click nonexistent button
click banana
click random thing
```

We want failures here.

Failures teach us more than successes.

---

# Batch 7 — Replanning Candidates

These are the most valuable.

```text
search github for playwright
search github for browser use
search youtube for openclaw
```

If any fail:

**DO NOT FIX YET**

Record exactly:

```text
Goal:
Planner Output:
Execution Result:
Observed Failure:
```

---

# Documentation Format

For every test send me:

```text
TEST:
search github for playwright

PLANNER:
(paste plan)

RESULT:
(success/failure)

OBSERVATION:
what actually happened
```

You don't need to format it.

Dump the raw logs and Telegram outputs.

I'll convert everything into:

```text
docs/browser-failures.md
docs/browser-evaluation.md
```

properly and we'll identify the actual bottlenecks before writing more code.

This phase is basically:

```text
Phase 3.6 = Browser Evaluation
```

not Browser Development.

We're finally stress-testing the architecture. 🚀


I agree. If we do this in 20 micro-steps we'll lose the architecture in the noise.

For Kairos I'd do **3 larger ADR-11 refactor waves**, each ending in a working system.

---

# Wave 1 — Intent Architecture (Big Refactor)

Goal:

```text
Remove goal.includes(...)
from the whole verifier stack
```

Files:

```text
cloud/src/planner/goalParser.js       NEW
cloud/src/planner/agent.js
cloud/src/agent/state.js
cloud/src/planner/stateVerifier.js
cloud/src/planner/eventVerifier.js
cloud/src/agent/context.js
cloud/src/memory/relevant.js
```

Result:

Instead of:

```js
goal
```

flowing everywhere:

```js
"search for history videos"
```

you get:

```js
{
  intent: "SEARCH",
  entities: [
    "history",
    "videos"
  ],
  constraints: {}
}
```

stored in agent state.

Everything downstream uses:

```js
intent
```

not:

```js
goal string
```

---

# Wave 2 — Generic Events + Generic State

Goal:

```text
Remove website-specific verification
```

Files:

```text
client/src/observer/events.js
cloud/src/planner/eventVerifier.js
cloud/src/planner/eventMatchers.js
cloud/src/planner/stateMatchers.js
cloud/src/planner/stateVerifier.js
```

Current:

```js
login_page_opened
video_page_opened
comments_visible
```

Future:

```js
AUTH_FORM_DETECTED
MEDIA_PLAYER_DETECTED
SECTION_VISIBLE
URL_CHANGED
FORM_DETECTED
CONTENT_CHANGED
NEW_ELEMENTS_VISIBLE
```

Then:

```js
AUTHENTICATE intent
```

can succeed on:

```text
GitHub
Google
Instagram
Facebook
```

without new code.

---

# Wave 3 — Multi-Step Goal Graphs

This is the real OpenClaw/Hermes step.

Files:

```text
cloud/src/planner/planner.js
cloud/src/planner/replanner.js
cloud/src/shared/schemas/task.js
cloud/src/shared/schemas/plan.js
cloud/src/planner/agent.js
```

Current:

```text
Goal
↓
Plan
↓
Execute
```

Future:

```text
Goal
↓
Task Graph

SEARCH
↓
OPEN_VIDEO
↓
OPEN_WIKIPEDIA
↓
READ_CONTENT

↓
Plan
```

Example:

User:

```text
Search for Greece videos on YouTube
Open Wikipedia in a new tab
Read the first section
```

Parser returns:

```js
[
  {
    intent: "SEARCH_VIDEO",
    topic: "greece"
  },
  {
    intent: "OPEN_REFERENCE",
    target: "wikipedia",
    newTab: true
  },
  {
    intent: "READ_CONTENT"
  }
]
```

Now Kairos becomes a workflow agent instead of a single-action planner.

---

# After ADR-11

Then:

```text
3.6 validation
3.7 memory
3.8 session memory
3.9 companion
```

becomes much easier because everything uses:

```text
Intent
Events
State
Tasks
```

instead of:

```text
Keywords
Website logic
Special cases
```

---

# What I would do right now

Let's do **Wave 1 completely in one pass**.

Before we touch code, I need these files because they are the ones Wave 1 will modify heavily:

```text
cloud/src/agent/state.js
cloud/src/agent/context.js
cloud/src/memory/relevant.js
cloud/src/planner/eventVerifier.js
cloud/src/planner/eventMatchers.js
```

Once I see those 5 files I can give you the full Wave 1 refactor (all file changes together), instead of drip-feeding one file at a time. That will get us from keyword-driven goals to intent-driven goals in a single working checkpoint.
