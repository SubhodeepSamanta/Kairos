# Architectural Decisions

## Decision 001

Planner never executes.

Reason:

Keeps reasoning separate from execution.

---

## Decision 002

Executor never plans.

Reason:

Keeps execution deterministic.

---

## Decision 003

Observer is mandatory.

Reason:

Agents cannot improve without feedback.

---

## Decision 004

Cloud thinks.

Client acts.

Reason:

Reduces client resource usage.

---

## Decision 005

Actions are the foundation of the system.

Reason:

Applications change.

Actions remain reusable.

Examples:

open_app

click

type

navigate

read

---

## Decision 006

No app-specific modules.

Reason:

Kairos should solve goals, not applications.

---

## Decision 007

Files should remain small.

Target:

300-400 lines maximum.

Split files before they become large.

---

## Decision 008

Phase-by-phase development.

A phase is complete before starting the next one.

Avoid building future systems prematurely.

Current phase:

Phase 1
