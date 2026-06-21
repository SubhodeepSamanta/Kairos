Generic states exist: home, results, content, login, settings. But semantic page kinds still include repository_page, video_page, product_page, etc. That is acceptable as page understanding, but risky when capabilities or routing treat those as workflow categories.
Hardcoding Inventory
Platform hardcoding in resolver
Why it exists: quick platform extraction and environment labels.
Why it hurts: each new site requires code awareness.
Fix: derive platform from host generically, move known environments into optional metadata.
Risk: low-medium.
Evidence: [currentStateResolver.js (line 69)](C:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js:69), [currentStateResolver.js (line 82)](C:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js:82).

Website URL map in navigation
Why it exists: “open youtube/github” convenience.
Why it hurts: platform registry becomes embedded in capability code.
Fix: move to a generic destination resolver or search/navigation service.
Risk: low.
Evidence: [NavigationCapability.js (line 31)](C:/Users/USER/Desktop/Kairos/cloud/src/capabilities/navigation/NavigationCapability.js:31).

Capability routing by desired state
Why it exists: old state-machine architecture.
Why it hurts: browser intelligence becomes “which capability handles this state?” instead of “which action advances the goal?”
Fix: replace router-first execution with action selection over observed affordances. Keep capabilities as low-level executors.
Risk: high.
Evidence: [router.js (line 12)](C:/Users/USER/Desktop/Kairos/cloud/src/capabilities/router.js:12), [router.js (line 39)](C:/Users/USER/Desktop/Kairos/cloud/src/capabilities/router.js:39).

Legacy capability bridge
Why it exists: backward compatibility after state normalization.
Why it hurts: content still becomes video_playing on YouTube and result_selected elsewhere, preserving platform-specific behavior.
Fix: retire legacy state mapping after capability contracts accept generic action intents.
Risk: medium-high.
Evidence: [stateNormalization.js (line 98)](C:/Users/USER/Desktop/Kairos/cloud/src/world/stateNormalization.js:98).

Result/media/form capabilities are still narrow
Why it exists: original implementation was task-class based.
Why it hurts: arbitrary browser tasks need affordance-level action choice, not separate “search/result/media/form” lanes.
Fix: introduce a generic ActionSelection layer that ranks all clickable/typeable/scrollable affordances against goal and page understanding.
Risk: high.
Evidence: [SelectionCapability.js (line 25)](C:/Users/USER/Desktop/Kairos/cloud/src/capabilities/selection/SelectionCapability.js:25), [MediaCapability.js (line 13)](C:/Users/USER/Desktop/Kairos/cloud/src/capabilities/media/MediaCapability.js:13), [FormCapability.js (line 12)](C:/Users/USER/Desktop/Kairos/cloud/src/capabilities/form/FormCapability.js:12).

Programmatic verification still has URL/string shortcuts
Why it exists: useful early test harness.
Why it hurts: tasks can pass because URL/page text matches, not because the human task is done.
Fix: route all browser objective verification through resolved semantic state plus goal-specific evidence.
Risk: medium.
Evidence: [stateMatchers.js (line 1)](C:/Users/USER/Desktop/Kairos/cloud/src/verification/stateMatchers.js:1), [stateMatchers.js (line 174)](C:/Users/USER/Desktop/Kairos/cloud/src/verification/stateMatchers.js:174).

Technical Debt Inventory
Two verification systems coexist: objectiveVerifier and stateVerifier/unifiedVerifier. This creates inconsistent success semantics. Fix by making one verifier authoritative.

Planner creates objectives, but transition generator still imposes a fixed home/direct/fallback pattern. This limits adaptive planning. Evidence: [transitionGenerator.js (line 31)](C:/Users/USER/Desktop/Kairos/cloud/src/reasoning/transitionGenerator.js:31).

Recovery is deterministic and retry-count based. It reads state, but does not truly diagnose cause. Evidence: [recovery.js (line 57)](C:/Users/USER/Desktop/Kairos/cloud/src/agent/recovery/recovery.js:57).

World model stores mostly URL/title/hash, not enough semantic page understanding to guide action. Evidence: [worldModel.js (line 16)](C:/Users/USER/Desktop/Kairos/cloud/src/world/worldModel.js:16).

Evaluation scenarios are still site-specific. Good as regression tests, weak as general browser-intelligence tests. Evidence: [scenarios.js (line 11)](C:/Users/USER/Desktop/Kairos/cloud/src/eval/scenarios.js:11).

Browser Intelligence Bottlenecks
The biggest bottleneck is that page understanding is descriptive, but action selection is still capability-routed. Kairos can label a page semantically, but it does not yet ask “what affordance best advances the goal?” across the whole page.
Second bottleneck: verification is not unified around goal evidence. Some paths use semantic state, some use capability verify, some use programmatic matchers.
Third bottleneck: transitions are still state-to-state, not belief-to-action. Human browsing often requires local actions that do not correspond to a clean state transition: dismiss modal, open menu, scroll, filter, sort, choose tab, inspect result, go back.
Refactor Roadmap
Unify verification first
Make objectiveVerifier the authoritative path. Deprecate or wrap stateVerifier and URL/string matchers. Verification should require platform/domain correctness, semantic page correctness, and objective-specific evidence.

Convert capabilities into primitive executors
Keep NavigationCapability, typing, clicking, scrolling, tab actions, extraction. Stop routing by website/task category. Capabilities should answer “can I perform this primitive action?” not “can I solve this objective?”

Add generic action selection
Given goal + page understanding + available elements, score possible actions: click, type, press, scroll, navigate, extract. This should replace SearchCapability, ResultCapability, and MediaCapability as decision-makers.

Strengthen page understanding
Resolver should output page purpose, available affordances, entities, constraints, and confidence. Keep semantic states, but do not let them become workflows.

Replace fixed transition generator
Move from home_to_results style transitions to “next best action proposal.” State transitions can remain as audit metadata, not the planning core.

Improve recovery as re-observation plus alternate action selection
Instead of retry-count escalation first, recovery should explain: no element, stale page, blocked modal, wrong page, no progress, unsafe action, missing credentials.

Rebuild evals around task classes
Keep GitHub/YouTube examples, but organize tests by browser skill class: navigate, search, select, inspect, fill form, recover from modal, extract, compare, continue workflow.

The direction is sound after the recent state normalization work, but the system is still halfway between “state-machine automation” and “browser operator.” The next major win is not more site support. It is making action selection and verification generic enough that site support falls out naturally.

Do Immediately

✅ Page Understanding

✅ Action Selection

✅ Verification Unification

✅ Recovery Refactor

Do Later

⚠️ Remove capability routing

⚠️ Replace transition generator

⚠️ Replace state machine

Much Later

⚠️ Full belief-state planner

⚠️ Operator-style world model

⚠️ Hierarchical planning

⚠️ Autonomous browser reasoning loops