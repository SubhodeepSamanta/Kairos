# Kairos Phase 1

## Objective

Build the minimum working agent loop.

Goal
↓
Plan
↓
Execute
↓
Observe

---

## Supported Actions

open_app

Only this action is required for Phase 1.

Additional actions will be added later.

---

## Success Criteria

User sends:

"Open Notepad"

Planner generates:

{
"type":"open_app",
"params":{
"app":"notepad"
}
}

Executor opens Notepad.

Observer verifies Notepad opened.

Result is returned.

---

## Deliverables

Cloud

* Telegram connector
* Planner
* WebSocket server

Client

* WebSocket client
* Executor
* Observer
* Windows app launcher

Shared

* Goal schema
* Action schema
* Plan schema
* Observation schema

---

## Explicitly Excluded

Memory

Research

Skills

Experience

Voice

Learning

Database

Capabilities

Replanning

These belong to future phases.
