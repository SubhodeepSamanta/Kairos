# Final Roadmap — Accepted & Locked

> User rated revised plan 90-95% correct.
> This doc captures final adjustments and locked execution order.
> No further planning. Next step = implementation.

---

## Adjustments Accepted

### 1. State Hashing → Move to A.5

Was Phase B. Now between A and B.

Reason: everything downstream depends on it.

Without state hash:
- Can't detect loops
- Can't measure observation quality
- Can't know if action worked

**Moved to: Phase A.5 (immediately after Phase A)**

---

### 2. Observation Quality → Phase B.5

Was mentioned but not placed.

Problem: `readPage()` assumes page ready. Sometimes returns:
- Loading skeleton
- Empty DOM
- Modal-blocked content

Planner needs confidence signal:
```js
observationQuality = { score: 0.82, reasons: [...] }
```

Low score → re-read, don't replan.

**Placed at: Phase B.5 (after loop detection, before dual budgets)**

---

### 3. Budget → Add MAX_LLM_CALLS

Was:
```js
MAX_GOAL_ACTIONS = 30
MAX_TASK_RETRIES = 5
```

Now:
```js
MAX_GOAL_ACTIONS = 30
MAX_TASK_RETRIES = 5
MAX_LLM_CALLS = 40
```

Actions ≠ LLM calls. Can have 12 actions but 70 LLM calls from verification loops.

---

### 4. Intent Redesign → Not Now

Keep intent as metadata. Stop using for verification. Don't redesign until after recovery + stable IDs + multi-tab.

---

### 5. Stable IDs → Before Multi-Tab

Was parallel with multi-tab. Now explicitly ordered before it.

Stable element references are foundation for multi-tab world model.

---

### 6. Pre-Implementation Audit: Action Lifecycle Trace

Before coding Phase A, trace one action through entire pipeline:

```
Planner → WebSocket → Executor → Observer → Server → WorldModel → Verifier
```

Document exact object shape at every hop. Find where data lost, mutated, or duplicated.

User insight: most failures = state propagation failures, not planning failures.

---

## Final Locked Roadmap

### Phase A — Immediate Stability

| # | Task | File |
|---|------|------|
| 1 | Fix PRESS_KEY state corruption | observer.js L338-365 |
| 2 | Remove `commonTargets` | goalParser.js L126-137 |
| 3 | Fix matchNavigation (action-based) | stateMatchers.js L1-10 |
| 4 | Remove `/watch` | eventMatchers.js L29-33 |
| 5 | Observable success criteria only | taskParser.js prompt |

### Phase A.5 — State Foundation

| # | Task | File |
|---|------|------|
| 6 | State hashing | worldModel.js (new function) |

### Phase B — Recovery

| # | Task | File |
|---|------|------|
| 7 | Loop detection | agent.js (new) |
| 8 | Observation quality scoring | observer.js / read.js |
| 9 | Per-task retry budget (MAX_TASK_RETRIES=5) | agent.js |
| 10 | Global goal budget (MAX_GOAL_ACTIONS=30) | agent.js |
| 11 | LLM call budget (MAX_LLM_CALLS=40) | provider.js / agent.js |

### Phase C — OpenClaw Architecture

| # | Task | File |
|---|------|------|
| 12 | Stable element identity | read.js + registry.js |
| 13 | Multi-tab world model | worldModel.js |
| 14 | Device abstraction layer | new adapter pattern |

### Phase D — Agent Parity

| # | Task | File |
|---|------|------|
| 15 | Extraction engine | new |
| 16 | Memory integration | relevant.js + store.js |
| 17 | HITL checkpoints | agent.js + WebSocket |
| 18 | Full agent loop validation | end-to-end tests |

---

## Execution Order

```
Step 0: Action lifecycle trace audit (no code changes)
Step 1: Phase A items 1-5
Step 2: Phase A.5 item 6
Step 3: Phase B items 7-11
Step 4: Phase C items 12-14
Step 5: Phase D items 15-18
```

Gate between each phase: lofi test must pass before advancing.

---

## Items NOT Implemented Now

| Item | Reason | When |
|------|--------|------|
| GoalVerifier deletion | Keep disabled, need later | Wave 3.10 |
| Intent redesign | Not blocking, low priority | After Phase C |
| requires/produces enforcement | Task graph works sequentially | Phase D |
| Multi-client WebSocket | Single client fine for now | Phase D |
| Request correlation IDs | No race conditions yet | Phase D |

---

## Current State Summary

Core loop alive. Planner works. Task graph works.

Failures concentrated in:
- Observation pipeline (data loss between hops)
- Verification (wrong matchers, unobservable criteria)
- Recovery (doesn't exist yet)

Fixing those = 70% → 90%+ reliability.

---

> Step 0 (action lifecycle trace) is next. Then Phase A implementation.
