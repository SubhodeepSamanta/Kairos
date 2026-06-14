Honestly, after seeing the schemas, I think Wave 3 is **the most important architectural wave in the whole project**.

The good news:

```text
Wave 1 ≈ done
Wave 2 ≈ mostly done
Wave 3 = where Kairos actually becomes an agent
```

---

# How many parts in Wave 3?

I would split it into **4 sub-parts**, not 10 tiny ones.

### Part A — Task Graph Schema

Replace:

```text
Goal
 ↓
Plan
 ↓
Actions
```

with:

```text
Goal
 ↓
Tasks
 ↓
Plan
 ↓
Actions
```

Files:

```text
cloud/src/shared/schemas/task.js
cloud/src/shared/schemas/plan.js
cloud/src/shared/schemas/goal.js
```

---

### Part B — Goal → Tasks

This is the big one.

User:

```text
Play a Greece history video
Open Wikipedia in a new tab
```

becomes:

```js
[
  {
    intent: "FIND_MEDIA",
    topic: "greece history"
  },
  {
    intent: "PLAY_MEDIA"
  },
  {
    intent: "OPEN_REFERENCE",
    target: "wikipedia",
    topic: "greece history",
    newTab: true
  }
]
```

Files:

```text
cloud/src/planner/goalParser.js
cloud/src/planner/agent.js
```

Possibly a new file:

```text
cloud/src/planner/taskGraph.js
```

---

### Part C — Task → Plan

Current:

```text
Goal
 ↓
LLM
 ↓
Actions
```

Future:

```text
Task
 ↓
LLM
 ↓
Actions
```

Example:

Task:

```js
{
  intent: "OPEN_REFERENCE",
  target: "wikipedia",
  topic: "greece"
}
```

Planner generates:

```js
[
  navigate,
  type,
  click
]
```

Files:

```text
cloud/src/planner/planner.js
cloud/src/planner/replanner.js
cloud/src/planner/validator.js
```

---

### Part D — Task Execution Loop

Current:

```text
Execute entire plan
Verify goal
Done
```

Future:

```text
Task 1
 ↓
Verify

Task 2
 ↓
Verify

Task 3
 ↓
Verify
```

Files:

```text
cloud/src/planner/agent.js
```

This is the biggest change.

---

# How long?

If done cleanly:

```text
Part A : 30 mins
Part B : 1-2 hours
Part C : 1 hour
Part D : 1-2 hours
```

So roughly:

```text
4-6 hours of coding
```

Not weeks.

The hard part is architecture, not code volume.

---

# How many files?

Probably:

```text
goal.js
task.js
plan.js

goalParser.js

agent.js

planner.js
replanner.js
validator.js

(possibly)
taskGraph.js
```

Around:

```text
8-10 files
```

---

# Biggest thing we must decide BEFORE coding

This is the key design question:

Should tasks be:

### Option 1

```js
{
  intent: "OPEN_REFERENCE",
  target: "wikipedia"
}
```

Very abstract.

Planner figures out everything.

---

### Option 2

```js
{
  intent: "OPEN_REFERENCE",
  target: "wikipedia",
  topic: "greece",
  newTab: true
}
```

Structured.

Planner gets more information.

---

OpenClaw/Hermes style systems use something much closer to:

```text
Option 2
```

because it reduces hallucinations.

---

# What I need before starting

Only these now:

```text
cloud/src/planner/planner.js
cloud/src/planner/replanner.js
cloud/src/planner/prompts/systemPrompt.js
```

I've seen parts of planner/replanner earlier, but I want the current versions together before designing the task graph layer.

After those 3 files, we can design Wave 3 properly and avoid another major refactor later.
