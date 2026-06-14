Yes, I get exactly what you're aiming for.

You don't want:

```text
Browser automation
↓
Can click buttons
```

You want:

```text
"Login to YouTube.
If verification appears ask me.
Then open History.
Then comment Great Video
on the first video."

↓
Agent figures everything out
↓
asks questions when needed
↓
handles surprises
↓
continues workflow
```

That means Wave 3 is not just "task graphs".

Wave 3 becomes:

```text
ADR-11 Wave 3
=
Agent Runtime
```

---

# Part 1 — Task Graph Engine

### Goal

Convert:

```text
Goal
↓
Plan
↓
Execute
```

into:

```text
Goal
↓
Tasks
↓
Plan task
↓
Execute task
↓
Next task
```

Example:

```text
Search Greek video
Open Wikipedia
Read section
```

becomes:

```js
[
  SEARCH_VIDEO,
  OPEN_REFERENCE,
  READ_CONTENT
]
```

---

### Files

Likely:

```text
cloud/src/shared/schemas/task.js
cloud/src/shared/schemas/goal.js
cloud/src/shared/schemas/plan.js

cloud/src/planner/agent.js

NEW:
cloud/src/planner/taskGraph.js
cloud/src/planner/taskParser.js
```

### Files changed

~6-8

### OpenClaw similarity

Before:

```text
25%
```

After:

```text
45%
```

because now Kairos understands workflows.

---

# Part 2 — Task Execution Runtime

### Goal

Execute tasks one by one.

Current:

```text
Execute plan
Done
```

Future:

```text
Task 1
↓
success
↓
Task 2
↓
success
↓
Task 3
```

---

Example:

```text
SEARCH_VIDEO
```

produces:

```text
navigate
read_ui
click
```

Then:

```text
OPEN_REFERENCE
```

gets its own plan.

---

### Files

```text
cloud/src/planner/agent.js

cloud/src/shared/schemas/task.js

NEW:
cloud/src/planner/taskExecutor.js
```

### Files changed

~4-6

### OpenClaw similarity

```text
60%
```

Now it behaves like a real workflow engine.

---

# Part 3 — Replanning Per Task

This is huge.

Current:

```text
Goal failed
↓
Replan goal
```

Future:

```text
Task failed
↓
Replan task
↓
Continue graph
```

Example:

```text
Open Wikipedia
```

fails.

Agent:

```text
Try alternate route.
```

without restarting whole workflow.

---

### Files

```text
cloud/src/planner/replanner.js
cloud/src/planner/agent.js

NEW:
cloud/src/planner/taskReplanner.js
```

### Files changed

~3-5

### OpenClaw similarity

```text
70%
```

---

# Part 4 — Human In The Loop

This is the questioning system.

---

Example:

Agent sees:

```text
Enter OTP
```

Agent:

```text
Need OTP.
```

waits.

User:

```text
786541
```

Agent resumes.

---

Example:

```text
Play a Greek video
```

Agent cannot infer.

Instead:

```text
Which platform?

1 YouTube
2 Vimeo
3 Other
```

User answers.

Agent continues.

---

Example:

```text
Google requests phone verification
```

Agent:

```text
Verification required.

Options:

1 Enter phone number
2 Use another method
3 Cancel
```

---

### Files

```text
cloud/src/chat/chat.js
cloud/src/router/router.js

NEW:
cloud/src/planner/clarifier.js
cloud/src/planner/humanLoop.js
```

### Files changed

~4-7

### OpenClaw similarity

```text
80%
```

---

# Part 5 — Dynamic State Machine

This is what separates agents from scripts.

Instead of:

```text
login
↓
click
↓
done
```

Agent does:

```text
observe
↓
reason
↓
decide
↓
observe
↓
reason
```

continuously.

---

Example:

Google suddenly shows:

```text
Choose account
```

Agent wasn't expecting it.

No problem.

State changes.

Planner adapts.

---

### Files

```text
cloud/src/planner/agent.js
cloud/src/planner/stateVerifier.js
cloud/src/planner/eventVerifier.js

NEW:
cloud/src/planner/decisionEngine.js
```

### Files changed

~5-8

### OpenClaw similarity

```text
90%
```

---

# Part 6 — Long Running Sessions

Example:

```text
Login
```

Agent asks:

```text
Need OTP
```

User goes away.

Returns 10 minutes later.

Sends:

```text
918274
```

Agent continues.

---

This introduces:

```text
waiting_for_user
paused
running
completed
```

task states.

---

### Files

```text
task.js
goal.js
agent.js

NEW:
sessionRuntime.js
```

### Files changed

~4-6

### OpenClaw similarity

```text
95%
```

---

# After Wave 3

Only then would I touch:

```text
Memory v2
Companion
Windows automation
Filesystem automation
Learning user preferences
```

because the runtime foundation is finally stable.

---

# Total Wave 3

Roughly:

```text
6 parts
```

Files touched:

```text
15-25
```

New files:

```text
6-10
```

Time:

```text
Several coding sessions
```

but the hardest part is actually Part 1 and Part 2. Once task graphs and task execution exist, the rest starts fitting naturally.

And yes—Human-In-The-Loop, clarification questions, OTP handling, verification pages, ambiguity handling, pausing and resuming should be designed into Wave 3 itself, not bolted on later. That avoids another architecture refactor after you start adding Windows automation, filesystem actions, and companion features.
