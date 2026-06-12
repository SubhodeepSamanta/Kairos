# Kairos Architecture Decision Records

## ADR-001

Title: Cloud/Client Architecture

Status: Accepted

Decision:

Kairos uses a cloud brain and local client architecture.

Cloud responsibilities:

* Planning
* Memory
* Research
* Replanning
* Reasoning

Client responsibilities:

* Browser automation
* Desktop automation
* File operations
* Local execution

Reason:

Keeps local device control separate from reasoning.

---

## ADR-002

Title: Browser Before Desktop

Status: Accepted

Decision:

Complete Browser Operator before Desktop Operator.

Reason:

Browser automation provides the largest capability increase with the least implementation complexity.

---

## ADR-003

Title: Windows First

Status: Accepted

Decision:

Desktop automation order:

1. Windows
2. macOS
3. Linux

Reason:

Primary development environment is Windows.

---

## ADR-004

Title: UI Automation Strategy

Status: Accepted

Decision:

Use Windows UI Automation (UIA) as the primary desktop interaction layer.

Reason:

More reliable than coordinate-based clicking.

---

## ADR-005

Title: FocusApp Deferred

Status: Accepted

Decision:

Do not build advanced focus/window-management features until Desktop Operator phase.

Reason:

Avoid building one-off hacks before the UIA subsystem exists.

---

## ADR-006

Title: Browser Operator Phase Structure

Status: Accepted

Decision:

Browser automation is Phase 3 and contains subphases 3.1 through 3.15.

Reason:

Browser capability is large enough to be its own major phase.

---

## ADR-007

Title: Companion Layer Priority

Status: Accepted

Decision:

Companion Layer is promoted ahead of several later technical phases.

Reason:

Kairos should become a useful partner, not only an automation tool.

ADR-008

Title:
Provider Strategy

Decision:

Use multiple providers.

Priority:

OpenRouter
Nvidia
Groq

Future:

Different models for different tasks.

Reason:

Reduce dependence on a single quota and preserve high-quality models for important reasoning.

# ADR-003 Browser Engine

## Status

Accepted

## Context

Kairos requires browser automation for web navigation, interaction, extraction, and future workflows.

The initial implementation uses Playwright Chromium controlled entirely by the client.

## Decision

Browser automation will use Playwright-managed browser instances.

Websites should be opened through browser actions such as:

* navigate
* back
* forward
* refresh

and not through desktop actions such as:

* open_app chrome

The browser engine owns its own browser lifecycle.

## Consequences

### Positive

* Consistent browser automation
* Cross-platform support
* Easy integration with extraction
* Easier observation and replanning

### Negative

* Separate from user Chrome profiles
* Session/profile support requires later phases

## Deferred

* Tabs
* Profiles
* Session persistence
* Login flows
* Browser state memory
* Browser workspaces
* Browser monitoring

## Phase Status

Phase 3.1 Browser Engine

Completed

Implemented:

* launchBrowser
* getPage
* navigate
* browser context
* snapshots
* browser recovery
* websocket execution

Future browser lifecycle actions remain internal until tabs and sessions are implemented.

Phase 3.3
Tabs
- new_tab
- switch_tab
- close_tab
- list_tabs

Phase 3.4
Windows
- new_window
- switch_window
- close_window
- list_windows

Decision:

Kairos will use Playwright Chromium for
Phase 3.1–3.5.

Reason:

- Fast development
- Stable automation API
- No profile complexity
- Enables browser actions quickly

Deferred:

- Real Chrome profiles
- Persistent sessions
- Multiple browser profiles
- Existing user cookies

Target Phase:

3.6 Profiles & Sessions

ADR-00X Architecture Debt

Observed:
- Executor switch growing
- Observer switch growing
- Validator duplicated
- Planner prompt monolithic
- Cloud index.js Telegram-coupled
- Response formatter embedded

Decision:
Defer until Browser Phase complete.

Refactor Pass #1 after Phase 3:
- Action registry
- Observer registry
- Formatter registry
- Prompt builder
- Message service abstraction

# ADR-008: Browser Element Grounding

Status: Accepted

Date: 2026-06-10

## Context

Kairos currently executes browser actions using text-based targeting and executor heuristics.

Example:

Goal:

search github for playwright

Generated actions:

* navigate(github)
* type(playwright)
* press_enter

The executor attempts to locate an input field automatically.

Observed issues:

* Hidden inputs selected
* Incorrect visible inputs selected
* Email fields selected instead of search fields
* Site-specific behavior causes inconsistent results

This creates brittle automation and poor scaling across websites.

---

## Decision

Kairos will adopt an Element Grounding architecture.

Browser actions will progressively move from:

click("Search")

and

type("playwright")

to:

click(element=12)

type(element=7, text="playwright")

Element identifiers are generated during UI extraction and stored in an element registry.

---

## Phase 1

Implement runtime element IDs.

read_ui returns:

{
"inputs": [
{
"id": 1,
"text": "Search GitHub"
}
]
}

A runtime element registry maps:

element_id -> Playwright locator

---

## Phase 2

Add element-aware actions.

Examples:

{
"type": "click",
"params": {
"element": 12
}
}

{
"type": "type",
"params": {
"element": 7,
"text": "playwright"
}
}

---

## Phase 3

Planner learns to use element IDs when available.

Example:

Inputs:

[1] Search GitHub
[2] Email

Goal:

search github for playwright

Planner output:

type(element=1, text="playwright")

press_key("Enter")

---

## Phase 4

Rich element metadata.

Elements contain:

* role
* label
* placeholder
* visible
* enabled

Example:

{
"id": 7,
"role": "textbox",
"label": "Search GitHub",
"placeholder": "Search GitHub"
}

---

## Phase 5

Session grounding.

Kairos remembers:

* known elements
* current page
* current tab
* recent successful actions

---

## Future Work

Potential future upgrades:

* Accessibility tree extraction
* Screenshot + DOM grounding
* Action history based replanning
* Long-term browser memory
* Multi-step workflow learning

---

## Consequences

Benefits:

* More reliable browser automation
* Fewer site-specific patches
* Better login support
* Better form completion
* Better research workflows
* Closer architecture to OpenClaw and Hermes

Tradeoffs:

* Increased planner complexity
* Requires element registry management
* Requires read_ui redesign

The reliability improvement is expected to outweigh the additional complexity.


# ADR-010: Prompt Compression and Context Budgeting

Status: Accepted

Date: 2026-06-11

## Context

Kairos currently sends a large planner system prompt containing:

* action definitions
* browser rules
* tab management examples
* navigation examples
* search examples
* click examples
* screenshot examples
* metadata examples
* repeated JSON examples

As browser capabilities expand, prompt size continues to grow.

Observed issues:

* increased token usage
* higher latency
* larger OpenRouter bills
* more inconsistent planner outputs
* conflicting examples
* reduced context available for browser state

Example:

A GitHub page may contain:

* 100+ links
* dozens of buttons
* large text content

The browser state can exceed the size of the actual user request.

Prompt bloat reduces planner efficiency and reliability.

---

## Decision

Kairos will move to a compressed prompt architecture.

The planner prompt should primarily contain:

* available actions
* output format
* browser state rules
* element grounding rules
* minimal examples

Examples should be treated as teaching material rather than documentation.

---

## Phase 1

Reduce duplicate examples.

Keep:

* one click example
* one type example
* one navigate example
* one search example

Remove:

* repeated click examples
* repeated search examples
* repeated navigation examples

---

## Phase 2

Create a dedicated output contract.

Planner always returns:

{
"actions": [...]
}

Never:

[
...
]

Never:

explanations

Never:

markdown

The output contract should appear once near the top of the prompt.

---

## Phase 3

Compress browser state.

Instead of sending:

* hundreds of links
* entire page text

Send:

* top visible inputs
* top visible buttons
* top relevant links

Apply limits.

Example:

* max 20 inputs
* max 20 buttons
* max 20 links
* max 1000 page characters

---

## Phase 4

Separate planner knowledge from execution knowledge.

Planner receives:

* actions
* browser state
* memory

Planner does not need:

* executor implementation details
* Playwright details
* debugging instructions

---

## Phase 5

Introduce dynamic prompt sections.

Include only relevant capability instructions.

Example:

If screenshot action is unavailable:

* do not include screenshot examples

If browser state exists:

* include browser grounding section

If browser state does not exist:

* omit browser grounding section

---

## Future Work

Potential upgrades:

* prompt templates by task type
* task-specific planners
* planner fine-tuning
* compressed browser summaries
* semantic page compression
* retrieval-based prompt assembly

---

## Consequences

Benefits:

* lower token usage
* lower cost
* lower latency
* more reliable plans
* more browser context available
* improved scalability

Tradeoffs:

* fewer examples available to the model
* prompt management becomes more dynamic

Expected result:

50–80% reduction in planner prompt size while improving planning consistency.


# ADR-010: Context Engine & Token Budgeting

Status: Accepted

Date: 2026-06-11

## Context

Kairos currently sends large amounts of information to language models.

Examples include:

* Large system prompts
* Full browser state
* Large observation objects
* Memory context dumps
* Repeated examples
* Repeated instructions

As browser capabilities, memory systems, companion features, desktop control, and long-running agents are added, context size will continue growing.

Without a dedicated context architecture, Kairos will face:

* Excessive token usage
* Slow response times
* Higher costs
* Provider context limits
* Reduced reliability

The problem is not action execution.

The problem is context management.

---

# Decision

Kairos will introduce a dedicated Context Engine.

The Context Engine becomes responsible for:

* Context retrieval
* Context compression
* Token budgeting
* Memory selection
* Environment summarization

No LLM component should directly receive raw application state, raw browser state, or full memory history.

Instead:

Raw Data
↓
Context Engine
↓
Compressed Context
↓
LLM

---

# Design Principles

## Principle 1 — Retrieval Over Dumping

Never send all memories.

Bad:

Send entire memory database.

Good:

Retrieve only memories relevant to the current task.

Example:

Goal:

Continue Kairos roadmap discussion

Retrieve:

* Current phase
* Recent decisions
* Active roadmap

Do not retrieve:

* Browser history
* Unrelated projects
* Old conversations

---

## Principle 2 — Compression Before Planning

Planner receives compressed context.

Bad:

URL
Title
500 links
200 buttons
2000 words of page text

Good:

Page: GitHub Login

Inputs:
[6] Username
[7] Password

Buttons:
[1] Sign In

Links:
[10] Forgot Password

---

## Principle 3 — Environment Awareness

Planner should understand:

* Browser state
* Desktop state
* Active tasks

Without receiving unnecessary detail.

---

## Principle 4 — Explicit Token Budgets

Every subsystem receives a budget.

Example:

Planner:
1500 tokens

Verifier:
500 tokens

Memory:
500 tokens

Companion:
1000 tokens

Research:
3000 tokens

Budgets may change over time.

---

# Context Categories

Kairos context is divided into categories.

## Identity Context

Permanent information.

Examples:

* Kairos identity
* User identity
* Core behavior rules

Small and stable.

---

## Task Context

Current task.

Examples:

* Goal
* Current step
* Active objective

Temporary.

---

## Environment Context

Current environment.

Examples:

* Browser state
* Desktop state
* Active applications
* Active tabs

Compressed.

---

## Project Context

Project awareness.

Examples:

* Current project
* Current phase
* Completed milestones
* Active blockers

Retrieved only when relevant.

---

## Memory Context

Relevant memories.

Retrieved by search.

Never fully loaded.

---

## Session Context

Current conversation continuity.

Examples:

* Current topic
* Current workflow
* Recent decisions

Short-term only.

---

# Browser Context Compression

Browser state should be transformed before reaching the planner.

Raw:

{
title,
url,
buttons,
inputs,
links,
text
}

Compressed:

Page:
GitHub Login

Inputs:
[6] Username
[7] Password

Buttons:
[1] Sign In

Links:
[10] Forgot Password

The planner should never receive unnecessary page text.

---

# Observation Compression

Observers produce detailed data.

Example:

{
before,
after,
pageState,
metadata,
links
}

Verifiers should receive only what is needed.

Example:

{
action: "click",
success: true,
changed: true
}

Large observation payloads should not be forwarded automatically.

---

# Memory Retrieval Pipeline

Memory database
↓
Retriever
↓
Relevance ranking
↓
Compression
↓
Planner

Only relevant memories are injected.

No memory dumping.

---

# Companion Compatibility

The Context Engine must support future companion systems.

Future companion features:

* Relationship memory
* Project awareness
* Session continuity
* Reflection
* Goal tracking
* Timeline generation

All companion features use retrieval and compression.

No feature may bypass the Context Engine.

---

# Desktop Compatibility

Future desktop state:

* Open windows
* Active application
* UI elements
* Window handles

Desktop state must be compressed exactly like browser state.

---

# Voice Compatibility

Future voice systems should inject:

* Transcript summary
* Speaker intent
* Relevant emotional context

Not full transcripts.

---

# Vision Compatibility

Future vision systems should inject:

* Visual summaries
* OCR summaries
* Relevant detections

Not raw image data.

---

# Long Running Agent Compatibility

Long-running tasks should store:

* Goal
* Current progress
* Last observation

The planner should not reload entire histories.

---

# Future Work

Potential future upgrades:

* Embedding retrieval
* Vector search
* Semantic compression
* Hierarchical memory
* Dynamic token budgeting
* Multi-agent context sharing

---

# Consequences

Benefits:

* Lower token usage
* Faster planning
* Better scalability
* Better companion support
* Better memory systems
* Better desktop support
* Better long-running agents

Tradeoffs:

* Additional architecture complexity
* Requires retrieval layer
* Requires compression layer
* Requires context management system

The long-term scalability benefits outweigh the added complexity.

ADR-010 establishes the Context Engine as a first-class Kairos subsystem.

Brief note for ADR-011 (later)

Don't implement this yet.

ADR-011: Observation Driven Planning

Goal:

Move from:

Plan Entire Workflow
↓
Execute Everything
↓
Verify

to:

Observe
↓
Plan Next Step
↓
Execute
↓
Observe
↓
Plan Next Step

This is what enables:

"Find a YouTube video and comment on it"
"Open GitHub and read the newest issue"
"Find a Reddit post and reply"
General website-agnostic workflows

ADR-010 makes Kairos cheaper and scalable.

ADR-011 makes Kairos genuinely autonomous.

ADR-010 Phase A
Context filtering

ADR-010 Phase B
Prompt split

ADR-010 Phase C
Browser compression

Test 3.6

Finish 3.6

Finish ADR-008 remaining pieces

Move to 3.7 Session Memory


Yes. I would do ADR-010 **before** serious 3.6 testing.

Right now you're testing on a moving foundation.

Current situation:

```text
Browser works
Element IDs mostly work
State propagation mostly works

BUT

Planner context is bloated
Browser context is huge
Prompt architecture is inefficient
```

So every 3.6 test is costing:

```text
read github
→ send 2000+ tokens

click sign in
→ send 2000+ tokens

search playwright
→ send 2000+ tokens
```

which is exactly why you're burning through Groq/OpenRouter.

---

# What ADR-010 should accomplish first

Before touching Companion, Memory V2, Desktop, etc.

We need:

```text
Prompt Layer V2
```

Instead of:

```text
System Prompt
+
Full Browser State
+
Full Memory
+
Goal
```

we move to:

```text
System Prompt
+
Relevant Context
+
Goal
```

---

# Phase A — Context Filtering

Current:

```text
Buttons: 26
Links: 121
Inputs: 2
Text: 2000 chars
```

sent every time.

New:

Goal:

```text
click sign in
```

Planner gets:

```text
Links:
[47] Sign in
```

Only.

---

Goal:

```text
search github for playwright
```

Planner gets:

```text
Inputs:
[27] Search GitHub

Buttons:
[3] Search
```

Only.

---

This alone probably cuts:

```text
2000 tokens
↓
300 tokens
```

---

# Phase B — Split System Prompt

Current:

```text
monster prompt
```

with:

```text
200+
examples
```

every request.

---

Instead:

### plannerRules.js

```text
Output JSON only
Use element ids
Use actions
```

---

### browserRules.js

```text
Use browser state
Prefer ids
```

---

### examples.js

Only load when needed.

Example:

```text
search github for playwright
```

loads:

```text
browser search examples
```

not:

```text
tabs
screenshots
metadata
scrolling
```

---

# Phase C — Context Compression

Current browser state:

```text
Buttons:
[1] Platform
[2] Resources
[3] ...
...
[121]
```

Store internally.

Planner receives:

```text
Relevant elements:

[47] Sign in
```

---

This is how OpenClaw and Hermes survive long sessions.

They don't resend the entire world every step.

---

# Phase D — Goal-Aware Context

Example:

Goal:

```text
click sign in
```

Need:

```text
sign in link
```

Don't need:

```text
120 other links
```

---

Goal:

```text
switch tab
```

Need:

```text
tabs
```

Don't need:

```text
page text
```

---

# Phase E — Memory Filtering

Current:

```text
entire memory context
```

Eventually:

```text
retrieve top 5 relevant memories
```

Only.

---

Example:

Goal:

```text
continue kairos work
```

Retrieve:

```text
Current phase
Current ADR
Current blockers
```

Not:

```text
old random conversations
```

---

# What happens after ADR-010

Then we retest 3.6.

Because:

```text
planner behavior changes
browser context changes
memory retrieval changes
```

so search workflows should be validated again anyway.

---

My order would be:

```text
ADR-010 Phase A
Context filtering

ADR-010 Phase B
Prompt split

ADR-010 Phase C
Browser compression

Test 3.6

Finish 3.6

Finish ADR-008 remaining pieces

Move to 3.7 Session Memory
```

That gives the biggest return for the least code.

If we do ADR-010 properly, Kairos goes from:

```text
~50 planner calls/day
```

to something closer to:

```text
300-500 planner calls/day
```

on the same free-provider budget, which makes continued development much less painful.


ADR-11.1
Observation Engine folder

ADR-11.2
pageDetector

ADR-11.3
elementDetector

ADR-11.4
formDetector

ADR-11.5
event aggregation

ADR-11.6
goal-aware verifier

ADR-11.7
lightweight LLM observer

ADR-11 Phase 1

Create:

src/observation/

Inside:

detectors/
pageDetector.js

Detect:

url_changed
title_changed

Input:

before
after

Output:

[
  "url_changed",
  "title_changed"
]
elementDetector.js

Detect:

new_inputs
new_buttons
new_links

removed_inputs
removed_buttons
removed_links

Example:

Before:

0 inputs

After:

username
password

Output:

login_form_candidate
new_inputs
modalDetector.js

Detect:

modal_opened
modal_closed

By comparing:

button counts
visibility
dialog role
ADR-11 Phase 2

Semantic detectors.

Not page specific.

Generic.

formDetector.js

Detect:

login_form_detected

signup_form_detected

search_form_detected

Based on labels.

Not websites.

Example:

email
password

↓

login_form_detected

Example:

search

↓

search_form_detected
contentDetector.js

Detect:

search_results_loaded

comments_loaded

article_loaded

video_page_loaded

Using page state.

ADR-11 Phase 3

Observation Memory

Store:

events

not only snapshots.

Example:

[
 "navigate",
 "search_results_loaded",
 "video_page_loaded",
 "comments_loaded"
]

Now replanner understands history.

ADR-11 Phase 4

Goal-aware observation scoring

Goal:

click sign in

Important events:

login_form_detected
url_changed

Ignore:

footer_loaded

Goal:

read comments

Important:

comments_loaded

Ignore:

cookie_banner_opened
ADR-11 Phase 5

LLM Observer

This is where most people do it wrong.

Don't replace deterministic detection.

Add an LLM layer after deterministic.

Deterministic Events
+
Page Summary
↓
LLM Observer

Input:

{
  "goal": "read comments",
  "events": [
    "url_changed",
    "comments_loaded"
  ]
}

Output:

{
  "goal_progress": 0.9,
  "next_hint": "comments available"
}

Small.

Cheap.

Not huge page dumps.

Then your example works

User:

Open YouTube
Play lofi hiphop
Open comments
Read first comment
Play related videos

Flow:

navigate
↓
video_page_loaded

click
↓
video_started

scroll
↓
comments_loaded

read
↓
comment_text_extracted

click related
↓
related_video_loaded

Planner sees events.

Not raw HTML.

What I would build next

Exactly this order: