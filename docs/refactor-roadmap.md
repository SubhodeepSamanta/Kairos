# Refactor Roadmap — Kairos Browser Agent

Transitioning from state-centric automation to a reasoning-driven agent.

## Phase 1 — Capability Simplification (Phase B)
- Delete semantic capabilities: `SearchCapability.js`, `SelectionCapability.js`, `MediaCapability.js`, `FormCapability.js`.
- Clean up `capabilities/index.js` to expose only primitive executors: `navigate`, `click`, `type`, `scroll`, `press_key`, `extract`, `open_tab`, `switch_tab`.
- Refactor `router.js` to route only based on these primitive executors.

## Phase 2 — Browser Reasoning Layer (Phases C, D, F, G)
- Create `cloud/src/reasoning/browserReasoner.js` as the decision-making coordinator.
- Create `cloud/src/reasoning/actionGenerator.js` to produce action candidates based on page understanding.
- Transition from `Goal -> State -> Transition -> Capability` to `Goal -> Understand Page -> Generate Candidate Actions -> Rank Actions -> Execute -> Observe -> Repeat`.

## Phase 3 — Universal Page Understanding & Ranking (Phases E, G)
- Refactor `world/pageUnderstanding.js` to extract generic concepts (`search interface`, `search results`, `article`, etc.) instead of website-specific page types.
- Build goal-aware ranking in `actionSelector.js` using goal relevance, page relevance, success history, and progress likelihood.

## Phase 4 — Authorship & Recovery (Phases H, I, J, K)
- Consolidate verification in `verification/objectiveVerifier.js` to use evidence-driven goals.
- Replace retry recovery in `recovery/recovery.js` with diagnostics-driven alternatives via `recovery/diagnoser.js`.
- Remove site-specific string checks and references to `github`, `youtube`, `amazon`, etc., across the client and server.
