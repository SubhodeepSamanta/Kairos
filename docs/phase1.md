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
