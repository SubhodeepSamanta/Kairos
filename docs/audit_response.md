# Audit Response — Corrections & Revised Plan

> Response to user review of `architecture_review.md`.
> Audit was 85% correct, 15% over-aggressive.
> This doc captures accepted corrections and revised execution plan.

---

## Accepted Corrections

### 1. GoalVerifier: Keep, Don't Delete

Audit said: dead code, remove.

User says: conceptually correct, needed later.

```
Task verifier  = did this step succeed?
Goal verifier  = did overall objective complete?
```

Task completion ≠ Goal completion.

**Decision**: Disable goalVerifier in agent loop (skip LLM call). Keep file. Re-enable Wave 3.10.

---

### 2. Intent System: Fix, Don't Remove

Audit said: remove intent-based matcher gating entirely.

User says: intent system useful. Implementation bad. Concept good.

Bad:
```js
if (intent === "media") → matchMediaLoaded
```

Good (future):
```js
intent = { domain: "browser", operation: "search" }
```

**Decision**: Keep intent parsing. Remove intent-based gating from verifiers. Matchers check observable state only. Intent stays as metadata for future use.

---

### 3. Attempt Counter: Dual Budget, Not Remove

Audit said: remove `attempt = -1` reset.

User says: need BOTH global + per-task budget.

Without per-task reset:
- Task 1 uses 8 retries
- Task 2 has 2 left
- Unfair

With only per-task reset:
- 5 tasks × 10 retries = 50 iterations
- Expensive

**Decision**: Implement dual budget system:
```
MAX_GOAL_ACTIONS = 30
MAX_TASK_RETRIES = 5
```
Whichever hits first → stop.

---

## Audit Gaps — What Was Missing

### Missing #1: Stable Element Identity

User flagged as top 5 priority.

Problem:
```
Read 1: Input[1] Button[2] Link[3]
Read 2: Input[1] Button[7] Link[9]
```

IDs shift between reads. Planner references stale IDs → click fails → replan → read → new IDs → click wrong thing.

OpenClaw uses stable references.

**Priority**: Phase C (foundation for recovery).

---

### Missing #2: State Hashing

Foundation for loop detection + recovery.

```js
stateHash = hash(url, title, controlSignature)
```

Then:
```
sameState + sameAction + sameState = loop detected
```

Wave 3.5 foundation.

**Priority**: Phase B.

---

### Missing #3: Observation Quality Score

`readPage()` assumes page ready. Not always true.

Page might be:
- Loading
- Skeleton
- Empty
- Behind modal

Need confidence signal before planning.

**Priority**: Phase B.

---

### Missing #4: Device Abstraction Layer

Current:
```
Planner → Browser Actions
```

Future:
```
Planner → Abstract Actions → Browser/Desktop/Terminal Adapter
```

Prevents rewrites when adding desktop/terminal.

**Priority**: Phase C.

---

## Revised Execution Plan

User's Phase A-D replaces audit's Priority 1-3.

### Phase A — Immediate Stability

| # | Fix | File |
|---|-----|------|
| 1 | Fix PRESS_KEY state corruption | observer.js L338-365 |
| 2 | Remove `commonTargets` site list | goalParser.js L126-137 |
| 3 | Remove `/watch` from matchMediaLoaded | eventMatchers.js L29-33 |
| 4 | Fix matchNavigation (action-based, not keyword) | stateMatchers.js L1-10 |
| 5 | Constrain success criteria to observable state | taskParser.js prompt |

### Phase B — Recovery Foundation

| # | Fix | File |
|---|-----|------|
| 6 | State hashing | worldModel.js (new) |
| 7 | Loop detection | agent.js (new) |
| 8 | Per-task retry budget (MAX_TASK_RETRIES=5) | agent.js |
| 9 | Global goal budget (MAX_GOAL_ACTIONS=30) | agent.js |

### Phase C — OpenClaw Architecture

| # | Fix | File |
|---|-----|------|
| 10 | Stable element identity | read.js + registry.js |
| 11 | Device abstraction layer | new adapter pattern |
| 12 | Multi-tab world model | worldModel.js |

### Phase D — Parity

| # | Fix | File |
|---|-----|------|
| 13 | Extraction engine | new |
| 14 | Memory integration | relevant.js + store.js |
| 15 | HITL checkpoints | agent.js + WebSocket |
| 16 | Full agent loop validation | end-to-end tests |

---

## What Stays From Audit (Confirmed Correct)

- ✅ matchNavigation verifying wrong task → fix
- ✅ matchMediaLoaded site-specific → remove
- ✅ commonTargets hardcoded → remove
- ✅ Dead matchEvents strings → remove
- ✅ PRESS_KEY observer corruption → fix
- ✅ Success criteria ungrounded → constrain prompt
- ✅ Replanner token explosion → compact observations
- ✅ "page unchanged" misleading signal → improve comparison
- ✅ Intent applied at goal level not task level → fix later

## What Changes From Audit

- ❌ Don't delete goalVerifier → disable, keep for later
- ❌ Don't remove intent system → keep as metadata, remove from gating
- ❌ Don't simply remove attempt reset → dual budget system
- ➕ Add stable element identity (audit missed)
- ➕ Add state hashing (audit missed)
- ➕ Add observation quality score (audit missed)
- ➕ Add device abstraction layer (audit underweighted)

---

## Current Scores (User Assessment)

| Area | Score |
|------|-------|
| Planner | 8.5/10 |
| Task Graph | 8/10 |
| Observation | 6.5/10 |
| Verification | 5.5/10 |
| Recovery | 2/10 |
| World Model | 7/10 |
| Token Efficiency | 8.5/10 |
| Multi-Tab | 2/10 |
| Desktop Readiness | 3/10 |

**Overall: 70-75% of solid browser agent architecture.**

Remaining 25-30% concentrated in verification, recovery, observability.

Core execution loop is alive. Failures now in understanding what happened after actions execute.

---

> Phase A is implementation-ready. Waiting for go signal.
