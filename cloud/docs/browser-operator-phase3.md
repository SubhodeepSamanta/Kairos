# Phase 3 Browser Operator Refactor

This phase keeps the state machine, transitions, and existing capability router. The change is to add generic page understanding and action selection around the current loop, then make objective verification the single authority.

## Observation Flow

```mermaid
flowchart LR
  A["Browser action result"] --> B["Observation/pageState"]
  B --> C["resolveCurrentState"]
  B --> D["understandPage"]
  C --> D
  D --> E["Planner context"]
  D --> F["Action selector"]
  D --> G["Recovery diagnosis"]
```

## Page Understanding Flow

```mermaid
flowchart TD
  A["Raw observation"] --> B["Generic state"]
  A --> C["Element inventory"]
  C --> D["Available actions"]
  C --> E["Important elements"]
  A --> F["Constraints"]
  A --> G["Entities"]
  B --> H["Page purpose"]
  D --> I["Page understanding object"]
  E --> I
  F --> I
  G --> I
  H --> I
```

Output shape:

```js
{
  pagePurpose,
  pageSummary,
  availableActions,
  importantElements,
  entities,
  constraints
}
```

## Action Selection Flow

```mermaid
flowchart TD
  A["User goal"] --> D["Generic action selector"]
  B["Page understanding"] --> D
  C["Available affordances"] --> D
  D --> E["Ranked action candidates"]
  E --> F["Existing capability plan when available"]
  E --> G["Fallback/recovery action when capability cannot act"]
```

The selector does not know about individual websites or content categories. It scores generic affordances such as typing into inputs, clicking visible controls, refreshing observation, going back, and scrolling.

## Verification Flow

```mermaid
flowchart TD
  A["Objective"] --> B["verifyObjective"]
  C["Observation or resolved state"] --> B
  B --> D["resolveCurrentState when needed"]
  D --> E["evaluateState"]
  E --> F["platform match"]
  E --> G["semantic state match"]
  E --> H["target match"]
  F --> I["verified/unverified"]
  G --> I
  H --> I
```

## Verification Consolidation

Authoritative path:

- `cloud/src/verification/objectiveVerifier.js`
- Main agent loop transition verification now uses `verifyObjective(currentObj, latestObs)`.

What is being removed from authority:

- Capability-specific `verify()` results are no longer the main transition success decision in the agent loop.
- `stateVerifier.js`, `stateMatchers.js`, and `unifiedVerifier.js` remain as compatibility modules, but should not be used for Browser Operator objective completion.

What remains:

- Existing capability `verify()` methods remain for backward compatibility and diagnostics.
- State machine and transition generation remain intact.
- Existing capability execution remains intact.

Migration plan:

1. Keep compatibility verifiers exported while all runtime completion checks move to `verifyObjective`.
2. Convert capability `verify()` methods into diagnostic helpers or remove them after no callers depend on them.
3. Replace `stateVerifier`/`stateMatchers` callers with `verifyObjective` or an objective-shaped adapter.
4. Add regression tests around `verifyObjective` for home, results, content, login, settings, extraction, and cross-platform mismatch.

## Recovery Flow

```mermaid
flowchart TD
  A["Failure"] --> B["Observe current page"]
  B --> C["understandPage"]
  C --> D["Diagnose constraints and state"]
  D --> E["selectActionCandidates"]
  E --> F["Execute best alternative action"]
  F --> G["Observe again"]
  E --> H["Escalate only after alternatives fail"]
  H --> I["Scroll as last local fallback"]
```

Recovery now prioritizes fresh observation, diagnosis, and an alternative generic action. Scrolling remains available, but only after better page-grounded alternatives are exhausted.
