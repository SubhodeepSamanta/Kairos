# Kairos Roadmap

## Vision

Kairos is a personal AI companion and operator.

Goals:

* Understand and converse naturally
* Remember people, projects and preferences
* Operate browsers and applications
* Execute long-running tasks
* Learn and use tools
* Act as both assistant and companion

---

# Phase 1 — Foundation ✅

Status: Complete

Components:

* Cloud service
* Client service
* WebSocket communication
* Planner
* Executor
* Telegram integration
* Shared schemas
* Basic desktop actions

Outcome:

Kairos can receive goals and execute actions remotely.

---

# Phase 2 — Agent Core ✅

Status: Complete

Components:

* Memory v1
* Research system
* Observation system
* Replanning
* Retry limits
* Goal verification
* Postgres persistence
* User preferences

Outcome:

Kairos can plan, execute, observe, retry and remember.

---

# Phase 3 — Browser Operator 🚧

Status: In Progress

## 3.1 Browser Engine

Status: Mostly Complete

* Playwright
* Browser launch
* Browser sessions
* Navigation

## 3.2 Navigation

Status: Mostly Complete

* Navigate
* Back
* Refresh

## 3.3 Tab Management

Status: Not Started

* New tab
* Close tab
* Switch tab
* List tabs

## 3.4 Interaction

Status: In Progress

* Click
* Type
* Scroll
* Keyboard input
* Wait actions

## 3.5 Extraction

Status: In Progress

* Read page
* Extract text
* Extract links
* Screenshots

## 3.6 Search Workflows

Status: Not Started

Examples:

* Search YouTube
* Search Google
* Search GitHub

## 3.7 Session Memory

Status: Not Started

Examples:

* Open YouTube
* Play music
* Pause it

## 3.8 Browser State Memory

Status: Not Started

Remember:

* Active browser
* Active tab
* Current page

## 3.9 Profiles

Status: Not Started

* Chrome profiles
* Browser profiles

## 3.10 Login Flows

Status: Not Started

* Gmail
* GitHub
* Reddit

## 3.11 Browser Observations

Status: Complete

* Page change verification
* Action verification

## 3.12 Browser Replanning

Status: Mostly Complete

* Retry browser actions
* Alternative strategies

## 3.13 Workspaces

Status: Not Started

Examples:

* Coding workspace
* Research workspace

## 3.14 Research Pipelines

Status: Not Started

Examples:

* Multi-site reading
* Comparison
* Summarization

## 3.15 Monitoring

Status: Not Started

Examples:

* News monitoring
* Website monitoring

Outcome:

Kairos becomes a real browser operator.

---

# Phase 4 — Companion Layer

Status: Planned

Components:

* Session awareness
* Relationship memory
* Personality system
* Project awareness
* Reflection system

Outcome:

Kairos becomes a companion instead of a tool.

---

# Phase 5 — Memory V2

Status: Planned

Components:

* Episodic memory
* Semantic memory
* Project memory
* Embeddings
* Vector retrieval

Outcome:

Smarter recall and contextual understanding.

---

# Phase 6 — Files & Documents

Status: Planned

Components:

* PDF support
* Word documents
* Excel files
* CSV analysis
* File operations

Outcome:

Kairos can understand and manage documents.

---

# Phase 7 — Desktop Operator

Status: Planned

Target Order:

1. Windows (UIA)
2. macOS
3. Linux

Components:

* Window management
* Element interaction
* Form filling
* Desktop workflows

Deferred:

* focusApp implementation
* advanced window control

Outcome:

Kairos can operate desktop applications.

---

# Phase 8 — Long Running Agents

Status: Planned

Components:

* Scheduled tasks
* Background monitoring
* Task queues

Outcome:

Kairos can work for hours or days.

---

# Phase 9 — Vision

Status: Planned

Components:

* Screenshots
* OCR
* Screen understanding

Outcome:

Kairos can understand visual interfaces.

---

# Phase 10 — Tool Learning

Status: Planned

Components:

* Dynamic tool registration
* Tool discovery
* Tool selection

Outcome:

Kairos can use tools without hardcoded workflows.

---

# Phase 11 — Multi-Agent System

Status: Planned

Components:

* Research agent
* Browser agent
* Memory agent
* Desktop agent
* Coordinator agent

Outcome:

Kairos becomes a distributed agent system.


# Companion Phase

Honestly, I think this is where Kairos becomes interesting.

Not:

```text
AI tool
```

but:

```text
AI teammate
```

I'd split it like this:

# 4.1 Session System

Current:

```text
message
reply
message
reply
```

Future:

```text
Session A
Session B
Session C
```

Examples:

```text
continue
what were we doing?
```

---

# 4.2 Project Awareness

Kairos knows:

```text
Current project
Current phase
Completed phases
Next tasks
Known blockers
```

Example:

```text
Where are we in Kairos?
```

Instant answer.

---

# 4.3 Relationship Memory

Not:

```text
browser=chrome
```

But:

```text
User likes finishing phases.
User dislikes half-built systems.
User prefers discussion before implementation.
```

This is probably already starting to emerge.

---

# 4.4 Personality System

Modes:

```text
Engineer
Teacher
Friend
Coach
Reviewer
```

Later maybe:

```text
Custom personalities
```

stored in DB.

---

# 4.5 Reflection Engine

Questions like:

```text
What did we finish this week?
What is blocked?
What should we do next?
```

Kairos generates answers from project history.

---

# 4.6 Goal Tracking

Store:

```text
Active goals
Completed goals
Abandoned goals
```

Example:

```text
Finish Browser Phase
```

Kairos tracks progress.

---

# 4.7 Project Timeline

Kairos remembers:

```text
Yesterday:
Fixed browser search.

Last week:
Finished Phase 2.

Current:
Phase 3.4 Interaction.
```

This is one of the most powerful companion features.

---

# 4.8 Conversation Continuity

Examples:

```text
Open Spotify

Close it
```

```text
Open Chrome

Close that
```

```text
We were discussing memory

Continue
```

No need to restate context.

---

# 4.9 Weekly Reviews

Example:

```text
What did we accomplish this week?
```

Kairos produces:

```text
Completed:
- Goal verification
- Browser observations

In progress:
- Browser interaction

Blocked:
- Tabs
```

---

# 4.10 Identity Layer

This is the last piece.

Kairos knows:

```text
Who it is
What it is building
Who it is helping
```

Not roleplay.

Actual project identity.

Example:

```text
What are you?

I am Kairos, your personal AI companion and operator.
Current project phase: Browser Operator.
```

---

If Browser Phase is:

```text
Kairos learns to operate software
```

then Companion Phase is:

```text
Kairos learns to maintain a relationship and shared history
```

And honestly, I think 4.2 (Project Awareness), 4.7 (Project Timeline), and 4.8 (Conversation Continuity) are the features that will make the biggest difference for us personally, because they're exactly the things we've been struggling with during the last few days.

Desktop Phase TODO

- Track spawned PIDs
- Track browser PIDs
- Close by PID
- Focus by PID
- Window handles