# Kairos Architecture

## Vision

Kairos is a goal-oriented personal computer agent.

Kairos should:

* Receive goals
* Create plans
* Execute actions
* Observe results
* Adapt when reality differs from expectations

Kairos is not a collection of app-specific automations.

Kairos operates through reusable actions and workflows.

---

## Core Principle

Think in goals.

Bad:

SpotifyService

Good:

Play Music

---

## Phase 1 Architecture

User
↓
Connector
↓
Planner
↓
Plan
↓
Client
↓
Executor
↓
Observer
↓
Result

---

## Responsibilities

### Planner

Responsible for:

* Understanding goals
* Generating plans
* Producing actions

Planner never executes.

---

### Executor

Responsible for:

* Running actions
* Calling automation modules

Executor never plans.

---

### Observer

Responsible for:

* Checking outcomes
* Returning observations

Observer never executes.

---

## Action Flow

Goal:

Open Notepad

Plan:

[
{
"type":"open_app",
"params":{
"app":"notepad"
}
}
]

Execution:

Executor runs action.

Observation:

Notepad window exists.

Result:

Success.

---

## Future Components

Phase 2:
Replanner

Phase 3:
Research

Phase 4:
Capabilities

Phase 5:
Memory

Phase 6:
Experience

Phase 7:
Skills

Phase 8:
Voice

These systems must plug into the existing architecture without modifying Planner, Executor, or Observer responsibilities.

---

## Non Goals

No app-specific services.

No Spotify module.

No WhatsApp module.

No Gmail module.

All applications should be controlled through reusable actions.
