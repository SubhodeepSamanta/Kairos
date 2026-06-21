# Browser Agent Architecture

The target architecture shifts Kairos from a hardcoded state machine to a goal-directed observation-action loop.

```
       ┌────────────────────────┐
       │     User Objective     │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   Observation / read   │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   Page Understanding   │
       └───────────┬────────────┘
                   │
                   ▼
┌───────────────┴───────────────┐
│       browserReasoner.js      │
│  - Generation (generator.js)  │
│  - Goal-aware Ranking         │
└───────────────┬───────────────┘
                   │
      h           ▼
       ┌────────────────────────┐
       │   Primitive Executor   │
       │   (click, type, etc.)  │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   Authoritative Verify │
       └────────────────────────┘
```

## Key Components

### 1. Browser Reasoner (`browserReasoner.js`)
Takes the current user goal, page understanding (structure, purpose), available actions, world state, and action history. Produces a ranked list of candidate actions to advance the goal.

### 2. Action Generator (`actionGenerator.js`)
Translates page elements and affordances into discrete candidate actions. It does not select a single static path but lists possibilities (e.g., clicking options, filling inputs, navigation).

### 3. Page Understanding (`pageUnderstanding.js`)
Classifies the page into generic web categories (`search interface`, `search results`, `article`, `video player`, etc.) using structural cues (inputs, buttons, text layout) rather than domain names.

### 4. Primitive Executors (`capabilities/index.js`)
Capabilities act strictly as executors of raw browser tasks (click, type, scroll, key press, extract data). They do not decide strategy.
