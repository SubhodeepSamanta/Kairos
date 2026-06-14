# Browser Evaluation

Date: 2026-06-10

---

## Search Workflow Evaluation

### YouTube Search

Tests:

- search youtube for lofi
- search youtube for minecraft
- search youtube for openclaw
- search youtube for ai agents
- search youtube for lo fi hip hop

Result:

PASS (5/5)

Observed Planner Output:

[
  navigate(youtube),
  type(query),
  press_key(Enter)
]

Example:

Goal:
search youtube for lofi

Generated Actions:

[
  {
    "type": "navigate",
    "params": {
      "url": "https://youtube.com"
    }
  },
  {
    "type": "type",
    "params": {
      "text": "lofi"
    }
  },
  {
    "type": "press_key",
    "params": {
      "key": "Enter"
    }
  }
]

Observed Result:

Before:
https://www.youtube.com/

After:
https://www.youtube.com/results?search_query=lofi

Title:
lofi - YouTube

Success:
Yes

---

Observations

1. Search box click was not required.

The type action successfully focused the search field automatically.

2. Multi-word queries worked.

Examples:

- ai agents
- lo fi hip hop

Both produced correct search URLs.

3. Planner simplified workflow.

Expected:

navigate
click
type
press enter

Actual:

navigate
type
press enter

This is preferable because fewer actions means fewer failure points.

4. Navigation resets search state.

Each search returns to:

https://youtube.com

before performing the next query.

This is reliable but may become inefficient later.

Potential future improvement:

If already on YouTube:

- reuse current tab
- reuse current search field
- avoid unnecessary navigation

Priority: Low

---

Failure Count

0

---

Conclusion

Current planner successfully composes multi-step browser actions for YouTube search workflows.

No planner changes required.
No replanner changes required.

Status:
PASS

## GitHub Search Evaluation

Tests

- search github for playwright
- search github for browser use
- search github for openclaw
- search github for react

Result

Partial Pass

Success:
2

Failure:
2+

Root Cause

Type action selects the first DOM input element.

GitHub's first input is:

<input type="hidden">

The type action repeatedly attempts to interact with a hidden field.

Observed Failure

locator.click timeout

Resolved Element:

<input name="type" type="hidden">

Assessment

Planner:
PASS

Replanner:
PASS

Verification:
PASS

Read UI:
PARTIAL

Type Action:
FAIL

Priority:
HIGH

### 3.6 Search Workflows

Status: Mostly Complete

Implemented generic search workflows through planning rather than hardcoded site-specific handlers.

Examples tested:

* Search YouTube for lofi
* Search YouTube for minecraft
* Search YouTube for openclaw
* Search YouTube for ai agents
* Search YouTube for lo fi hip hop

Execution pattern:

1. Navigate to target website
2. Type search query
3. Press Enter
4. Verify resulting page

Example plan:

navigate(youtube.com)
type("lofi")
press_key("Enter")

Results:

* All YouTube searches completed successfully
* Result URLs changed correctly
* Result page titles reflected search query
* Planner generated workflow automatically

Google testing:

Queries tested:

* browser agents
* openai
* langchain
* latest ai news
* playwright

Observed behavior:

* Searches successfully executed
* Result pages loaded correctly
* Subsequent actions confirmed navigation occurred

Issue discovered:

Action logging captured browser state too early after Enter key press.

Example:

After Enter:
title = ""

Next run:
title = "playwright - Google Search"

This indicates navigation completed after observation capture.

Planned fix:

Replace fixed delays with event-based waiting:

* waitForNavigation
* waitForLoadState
* URL change detection

Telegram issue discovered:

Large extraction responses exceeded Telegram message limits.

Error:

400 Bad Request: message is too long

Cause:

Google result extraction returned thousands of characters and hundreds of links.

Planned fixes:

* Result truncation
* Top-N link extraction
* Summarized output formatting

Outcome:

Kairos can perform generic website search workflows without hardcoded YouTube, Google, or GitHub logic.


# Kairos Agent Architecture Roadmap

## Current Status

### Wave 1 — Intent Architecture

Status: Complete

Goal:

Replace raw goal string usage throughout the system with structured intents.

Flow:

Goal
↓
Intent Parser
↓
Intent Object
↓
Planner / Memory / Context / Verification

Example:

User:
"Play a Greece history video"

Intent:

{
"type": "media",
"action": "play",
"entities": [
"greece",
"history",
"video"
]
}

Result:

* Planner uses intent
* Memory uses intent
* Context ranking uses intent
* Verifiers use intent
* Goal keyword logic centralized in goalParser.js

---

### Wave 2 — Generic Events & State

Status: Complete

Goal:

Remove website-specific verification.

Old:

login_page_opened
youtube_video_opened
comments_visible

New:

url_changed
content_changed
form_detected
auth_form_detected
buttons_detected
links_detected
content_loaded
text_entered
tab_created
tab_closed
tab_switched

Result:

Verification becomes generic.

Authenticate intent works for:

* Google
* YouTube
* GitHub
* Reddit
* Instagram

without new code.

---

# Wave 3 — Task Execution Architecture

This is the major transition from planner to agent.

Goal:

Move from:

Goal
↓
Plan
↓
Execute

to:

Goal
↓
Intent
↓
Task Graph
↓
Task Executor
↓
Planner
↓
Execute
↓
Observe
↓
Verify
↓
Replan

---

## Part 1 — Task Graph

New File:

cloud/src/planner/taskGraph.js

Purpose:

Convert one user goal into multiple tasks.

Example:

User:

"Play a Greece history video on YouTube and open Wikipedia in a new tab"

Task Graph:

[
{
"id": "task_1",
"intent": "PLAY_MEDIA",
"topic": "greece history",
"target": "youtube"
},
{
"id": "task_2",
"intent": "OPEN_REFERENCE",
"topic": "greece history",
"target": "wikipedia",
"newTab": true
}
]

Result:

Agent understands workflows instead of single actions.

---

## Part 2 — Task Status Engine

Task statuses:

PENDING
RUNNING
COMPLETED
FAILED
BLOCKED
SKIPPED

Purpose:

Track task lifecycle.

Examples:

Need OTP:
BLOCKED

Already on correct page:
SKIPPED

Task finished:
COMPLETED

This becomes the foundation for long-running workflows.

---

## Part 3 — Task Executor

New File:

cloud/src/planner/taskExecutor.js

Purpose:

Execute tasks one-by-one.

Flow:

Task 1
↓
Plan
↓
Execute
↓
Verify
↓
Complete

Task 2
↓
Plan
↓
Execute
↓
Verify

Instead of generating one giant plan.

---

## Part 4 — Task-Level Replanning

Current:

Goal fails
↓
Replan everything

Future:

Task fails
↓
Replan only that task

Example:

AUTHENTICATE fails.

Replan AUTHENTICATE only.

Do not regenerate:

OPEN_HISTORY
OPEN_VIDEO
COMMENT

This dramatically improves reliability.

---

## Part 5 — Blocking & Clarification

Purpose:

Allow agent to pause and ask for information.

Task:

{
"status": "BLOCKED",
"reason": "need_phone_number"
}

Examples:

need_phone_number
need_otp
need_file_path
need_confirmation
ambiguous_request

Agent asks user.

User replies.

Task resumes.

No restart.

No new goal.

---

## Part 6 — Task Context

Every task stores working memory.

Example:

{
"intent": "AUTHENTICATE",
"context": {
"email": "[user@gmail.com](mailto:user@gmail.com)",
"phone": null,
"otp": null
}
}

Later:

User:

"OTP is 7856"

Task updates:

{
"otp": "7856"
}

Execution continues.

---

## Part 7 — Resume Engine

Every task tracks progress.

Example:

{
"currentStep": 2
}

Authentication flow:

Step 1:
Email

Step 2:
Phone Verification

Step 3:
OTP

If blocked at OTP:

Resume from Step 3.

Do not restart Step 1.

---

## Part 8 — Task Dependencies

Schema support:

{
"id": "open_history",
"dependsOn": [
"authenticate"
]
}

Purpose:

Prevent impossible execution order.

Example:

Cannot open YouTube History before authentication.

Future workflows rely heavily on this.

---

# Clarification Architecture

Clarification happens BEFORE planning.

Flow:

Goal
↓
Intent
↓
Task Graph
↓
Confidence Check

Confidence Low?
↓
Ask User
↓
Update Task Graph
↓
Plan

Example:

User:
"Play a Greek video"

Task:

{
"intent": "PLAY_MEDIA",
"topic": "greek",
"source": null,
"confidence": 0.4
}

Agent:

"Where would you like me to play it?

* YouTube
* Netflix
* Local File"

Then planning begins.

---

# Authentication Architecture

Goal:

Handle real-world authentication dynamically.

Example:

Login to YouTube

Agent:

1. Enter email
2. Click next

Unexpected page appears:

"Verify with phone"

Observation:

auth_form_detected

Task:

AUTHENTICATE

Status:

BLOCKED

Reason:

need_phone_number

Agent:

"Please provide the phone number."

User:

"37478"

Agent resumes.

Later:

OTP page appears.

Status:

BLOCKED

Reason:

need_otp

User:

"7856"

Agent resumes from OTP step.

Authentication completes.

No restart.

No special-case code.

---

# Long-Term Architecture

Final core architecture:

Goal
↓
Intent
↓
Task Graph
↓
Task Executor
↓
Planner
↓
Execute
↓
Observe
↓
Verify
↓
Replan
↓
Continue

Capabilities built later:

* Browser Automation
* Windows Automation
* Filesystem
* Terminal
* Research
* Memory
* Companion

These become capabilities plugged into the same architecture.

No further core redesign should be required.
