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
