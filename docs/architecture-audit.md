# Architecture Audit — Kairos Browser Agent

## 1. Current Dependency Graph
```mermaid
graph TD
    agentLoop.js --> objectiveLoop.js
    agentLoop.js --> transitionLoop.js
    agentLoop.js --> executionLoop.js
    agentLoop.js --> verificationLoop.js
    agentLoop.js --> worldModel.js
    agentLoop.js --> pageUnderstanding.js
    agentLoop.js --> intentParser.js
    agentLoop.js --> planner.js
    agentLoop.js --> objectiveTracker.js
    
    executionLoop.js --> router.js
    executionLoop.js --> actionSelector.js
    
    router.js --> capabilities/index.js
    
    verificationLoop.js --> recovery.js
    verificationLoop.js --> objectiveVerifier.js
    verificationLoop.js --> agentSession.js
```

## 2. Current Execution Graph
```mermaid
sequenceDiagram
    participant AL as agentLoop
    participant OL as objectiveLoop
    participant TL as transitionLoop
    participant EL as executionLoop
    participant VL as verificationLoop
    participant C as Capability
    
    AL->>OL: processObjectives()
    Note over OL: Check if objectives complete & verify current objective
    AL->>TL: processTransitions()
    Note over TL: Generate transition to target state
    AL->>EL: selectCapabilityAndPlan()
    EL->>C: execute()
    AL->>VL: executeAndVerify()
    Note over VL: Run capability actions & verify state
```

## 3. Current Planner Flow
1. **parseIntent**: Parses user goal into intent type and platform.
2. **planObjectives**: Decomposes the intent into a series of transition state-machine objectives (e.g. `reach_entry_point` -> `locate_target` -> `interact_with_target`).

## 4. Current Verification Flow
- **verifyObjective**: Runs local matcher rule logic based on desired state and URL, falling back to LLM-based verification.
- Sites/capabilities specify URL patterns (e.g. checking `/watch` for YouTube video pages).

## 5. Current Recovery Flow
- **determineRecovery**: Runs when verification fails.
- Evaluates transition retries. If count is high, escalates (e.g., changes capability, replans transitions, or requests human intervention).

## 6. Hardcoding Inventory
- **Site-Specific Matches**: `youtube` / `/watch` checks in `MediaCapability.js` and `eventMatchers.js`.
- **Closed Intent Enum**: `goalParser.js` hardcodes sites (github, youtube, etc.) and intents (media, auth).
- **Environment Mapping**: `currentStateResolver.js` maps platforms to specific environment types.

## 7. Technical Debt Inventory
- **Dual Capability Models**: Primitive executors (`ClickExecutor`, etc.) in `capabilities/index.js` conflict with semantic capabilities (`SearchCapability`, etc.) in folders.
- **State-Transition Machine Overhead**: Planner constructs a sequence of transitions which capability logic must decrypt back into click/type actions.
- **Misaligned Page Types**: Website-specific designations (e.g., `repository_listing`, `video_player_page`) bias routing.
