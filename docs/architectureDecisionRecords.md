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