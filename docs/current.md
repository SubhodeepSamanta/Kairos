# Kairos — Current State (June 2026)

## Architecture

```
User → Telegram / CLI
  ↓
Cloud (Node.js, port 8080)
  ├── router → chat / research / agent
  ├── LLM (Groq → OpenRouter → Nvidia fallback)
  ├── Memory (PostgreSQL key-value)
  ├── Research (web search + summarization)
  └── Agent Loop (planner → executor → observer → verifier)
  ↓  WebSocket
Client (Node.js)
  ├── Playwright (Chromium, non-headless)
  ├── Desktop (Windows UIA stub)
  ├── Observer (action → observation)
  └── Connectors (CLI console)
```

Two separate Node.js services communicating over WebSocket at `ws://localhost:8080`. Cloud is the brain, client is the hands.

---

## Agent Loop (`cloud/src/agent/loop/agentLoop.js`)

The core: `runAgent(goal, executePlan)` — a single async function that:

1. **Reads initial page state** via `read_ui`
2. **Decomposes goal** into sub-objectives via LLM (3-7 steps)
3. **Loops** (adaptive budget, ~20-40 iterations):
   - Reads current page → `understandPage()`
   - Generates action candidates → `generateActions()`
   - Selects best action → `selectActionWithLLM()` (LLM + heuristic fallback)
   - Executes via WebSocket → `executePlan()`
   - Observes result → `observeAction()`
   - Updates world model → `updateWorldModel()`
   - Verifies goal → `verifyGoal()` (heuristic + LLM)
   - Recovers on failure → `determineRecovery()`
4. Returns success/failure with observation

**Key subsystems within the loop:**
- Loop detection (detects 2-cycle and 3-cycle action loops, force-scrolls to unstick)
- Human intervention checks (CAPTCHA, OTP, financial actions, low-confidence)
- Plugin system hooks (before/after action selection & execution)
- Context compression for LLM calls
- Resource allocation (adaptive limits)
- Runtime learning (tracks interactions)
- Session persistence (save/load agent state to JSON files)

---

## Schemas (`cloud/src/shared/schemas/`, `client/src/shared/schemas/`)

**Actions** (`action.js`):
- `open_app`, `close_app`, `focus_app` — desktop
- `navigate`, `click`, `type`, `read_ui`, `press_key`, `scroll` — browser
- `new_tab`, `switch_tab`, `close_tab`, `list_tabs` — tabs
- `back`, `forward`, `refresh` — navigation
- `screenshot`, `extract_metadata`, `extract_links`, `extract_data` — extraction
- `wait`, `restart_browser`, `close_browser`, `get_browser_context` — utilities

**Plans** (`plan.js`): `{ goalId, actions[], createdAt }`

**Goals** (`goal.js`): `{ id, objective, intent, tasks[], status, world{...}, createdAt }`

**Observations** (`observation.js`): built by `observeAction()` with before/after snapshots, pageState, events

---

## Reasoning System (`cloud/src/reasoning/`)

### Goal Understanding (`goalUnderstanding.js`)
Parses raw text into: `{ objective, capabilities[], constraints[] }`
- Objectives: `consume media`, `authenticate`, `extract_information`, `search_content`, `navigate`, `research`, `discover opportunities`, `retrieve artifact`
- Capabilities extracted from keyword matching
- Constraints extracted via regex patterns

### Action Generator (`actionGenerator.js`)
Generates candidate actions from page state + goal:
- Navigation candidates from goal capabilities
- Type/search candidates from input affordances
- Click candidates from buttons/links
- Scroll, back, read_ui as fallbacks
- Dynamic adaptations per page type (search pages → prioritize type/search, video pages → play actions)
- Pattern learning from action history

### Action Selector (`llmActionSelector.js`)
Two-path selection:
1. **LLM path**: Builds system prompt with page context → asks LLM for next action → validates element IDs → matches to candidate list
2. **Heuristic fallback**: `scoreAction()` + `rankActions()` — scores candidates on goal relevance, page purpose, affordance confidence, failure penalties

### Scoring Heuristics (`actionSelector.js`)
- Goal term overlap (+20 per match)
- Objective-specific boosts (media, authenticate, extract)
- Page purpose matching (search results → click result links, login flow → type/click)
- Risk penalties (scroll -30, back -50, read_ui -40)
- In-viewport bonus (+10)
- Failure history penalties (-75 per repeat failure)

---

## Browser Automation (`client/src/automation/browser/`)

### Browser Manager (`browser.js`)
- Playwright Chromium, non-headless
- Single browser instance, multiple tabs (pages array)
- `launchBrowser()`, `getPage()`, `switchTab()`, `closeTab()`, `listTabs()`, `createNewTab()`
- Global mutable state: `browser`, `pages[]`, `activePageIndex`, `context`

### Element Reading (`actions/observation/`)
- **Prepare Page**: Injects `data-kairos-id` attributes on interactive elements (buttons, inputs, links, forms)
- **Button Reader**: Reads `<button>`, `[role="button"]` — text, aria-label, visibility, bounding box, purpose classification
- **Input Reader**: Reads `<input>`, `<textarea>`, `[contenteditable]` — placeholder, name, type, value, purpose classification
- **Link Reader**: Reads `<a>`, `[role="link"]` — text, href, aria-label, purpose classification
- **Page Reader**: Orchestrates reading → classifies page type → caps elements (50 buttons, 20 inputs, 200 links) → scores quality

### Element Classification (`actions/classifier/`)
- **elementClassifier.js**: Regex-based purpose detection (`search_input`, `form_input`, `action_target`, `confirmation_action`, `navigation_target`, `primary_content`)
- **pageClassifier.js**: Regex-based page type detection (`content_presentation`, `content_discovery`, `media_interaction`, `access_control`, etc.)
- **dynamicClassifier.js**: Additional classification
- **index.js**: aggregates classifiers

### Input Actions (`actions/input/`)
- **click.js**: Clicks by element ID → fallback to text-based selectors. Rich before/after snapshot comparison (URL, title, body, focus, media, overlay, element states). Determines success from any state change.
- **type.js**: Types text into element by ID
- **pressKey.js**: Presses keyboard keys (Enter, Escape, etc.)

### Navigation Actions (`actions/navigation/`)
- **navigate.js**: Navigate to URL
- **back.js**, **forward.js**, **refresh.js**: Navigation controls

### Tab Actions (`actions/tabs/`)
- **newTab.js**, **switchTab.js**, **closeTab.js**: Tab management

### Extraction Actions (`actions/observation/`)
- **screenshot.js**: Take screenshot
- **extractMetadata.js**: Extract page metadata
- **extractLinks.js**: Extract all links

### Element Registry (`elements/registry.js`)
- Maps `data-kairos-id` → Playwright locator for stable element references

---

## Page Understanding (`cloud/src/world/`)

### Page Understanding V2 (`pageUnderstandingV2.js`)
Server-side semantic understanding of page state:
- **Purpose inference**: `search_workflow`, `content_navigation`, `content_delivery`, `data_interaction`, `access_control`, `search_interface`, etc.
- **Workflow detection**: Maps purposes to workflows (search → `content_discovery`, auth → `authentication`)
- **Constraint detection**: CAPTCHA, cookie consent, blank page, password fields
- **Risk detection**: Payment, destructive actions, MFA
- **Entity extraction**: Prices, counts, dates, interface elements
- **Affordance extraction**: Collects action hints from important elements

### Current State Resolver (`currentStateResolver.js`)
- Resolves platform (from hostname or pageType)
- Resolves environment (search_site, media_site, commerce_site, etc.)
- Resolves semantic state (home_active, search results, media content, content detail, authenticated, form, settings)
- Normalizes state for comparison

### World Model (`worldModel.js`)
- SHA-256 state hashing for change detection
- Action history (last 50, persisted)
- Failed action history (last 20)
- Page understanding cache (last 5)
- Progress indicators (total actions, unchanged pages count)
- Findings and entities (dead infrastructure — never called)

---

## Verification (`cloud/src/verification/`)

### Objective Verifier (`objectiveVerifier.js`)
Two-stage verification:
1. **Heuristic pass**: Checks objective type against page state:
   - `extract_information`: findings exist
   - `consume media`: page capabilities include media
   - `search_content`: result elements present
   - `authenticate`: profile/dashboard page
   - `navigate`: non-blank URL
2. **LLM confirmation pass**: Only runs if heuristic passes. Asks LLM if goal achieved.

### Additional verifiers (mostly unused/dead):
- `stateVerifier.js`, `stateMatchers.js`, `eventVerifier.js`, `eventMatchers.js`
- `goalVerifier.js` — early returns, unreachable
- `failureVerifier.js` — unused
- `unifiedVerifier.js` — unused

---

## Memory System (`cloud/src/memory/`)

### Storage
- PostgreSQL (`memories` table): key-value with type, key, value, timestamps
- `saveMemory()` / `getMemory()` / `searchMemories()`

### Memory Pipeline
1. **extractMemory()**: LLM-based extraction from user messages. Skips action commands and questions. Extracts preferences and facts.
2. **storeMemory()**: Saves to PostgreSQL if `store: true`
3. **retrieveMemory()**: Loads all memories, substring-matches against query (naive, doesn't scale)

### WorkflowMemory (`workflowMemory.js`)
In-memory session state:
- Current objective/sub-objective
- Open tabs with purposes and relationships
- Visited pages
- Previous searches and actions
- Authentication state
- Partial form data

### Execution Context (`executionContext.js`)
- World facts (LLM-extracted triple facts from pages, capped at 100)
- Discovered entities (capped at 100)
- Visited pages (capped at 50)
- Open/completed questions

---

## Recovery System (`cloud/src/agent/recovery/`)

### Diagnoser (`diagnoser.js`)
Pattern-matches failure types:
- CAPTCHA/human verification → escalate to human loop
- Rate limiting → wait 5s
- Cookie consents/modals → click dismiss
- Blank page → navigate to Google
- Missing element → scroll + re-read
- No interactive elements → go back
- Stale/no progress → scroll + re-read

### Recovery (`recovery.js`)
- Runs diagnoser → adaptive recovery → fallback (refresh + read_ui)
- Escalates to human loop after 3 retries

### Adaptive Recovery (`adaptiveRecovery.js`)
- Learning-based recovery with pattern tracking
- Maps failure patterns to recovery strategies
- Maintains failure/success pattern history (100 each)
- Current implementation is mostly simulated (`setTimeout(100)`), not actually executing recovery

---

## Desktop Automation (`client/src/automation/desktop/`)

### Current State: ~20% complete

- **uia.js** — EMPTY (0 bytes). Windows UI Automation not implemented.
- **apps.js** — Uses PowerShell `Get-StartApps` to list installed apps. Can open by AppID via `explorer.exe shell:AppsFolder\...`. Hardcoded PROCESS_NAMES for notepad and calculator.
- **closeApp()** — `taskkill /F /IM`
- **focusApp()** — stub, always returns success

Only 3 actions: `open_app`, `close_app`, `focus_app`. No observation, no verification, no window management.

---

## Terminal & Filesystem (`client/src/automation/terminal/`, `client/src/automation/filesystem/`)

All files are **empty (0 bytes)**. Terminal execution and filesystem operations are not implemented.

---

## Connectors

### Telegram Bot (`cloud/src/connectors/telegram/`)
- `node-telegram-bot-api` with polling
- Error handling swallows polling errors (Telegram blocking)
- Routes messages through the cloud's message handler

### CLI Console (`client/src/connectors/cli/`)
- `kairos` process → `startKairos` command → spawns separate terminal window
- Console connects to cloud WebSocket, sends goals, displays results
- Commands: `/help`, `/clear`, connection status

### CLI Human Loop (`cloud/src/humanLoop/cliHumanLoop.js`)
- Listens for `intervention_needed` events
- `resume <goalId>` / `cancel <goalId>` commands
- Saves sessions to `sessions/` directory as JSON

---

## LLM Provider (`cloud/src/llm/provider.js`)

Three-provider fallback chain:
1. **Groq** (llama-3.3-70b-versatile)
2. **OpenRouter** (configurable model)
3. **Nvidia** (configurable model)

- Provider-level call count tracking (max 80 calls)
- Context manager integration for token tracking
- No token budget enforcement at the provider level

---

## Research System (`cloud/src/research/`)

- Web search → content extraction → deduplication → summarization → citation building → formatting
- Routes: messages containing "news", "latest", "research", "weather", etc.

---

## Known Gaps & Issues

### Empty/Stub Files (0 bytes)
- `client/src/automation/desktop/windows/uia.js` — Windows UIA not implemented
- `client/src/automation/terminal/execute.js` — terminal execution not implemented
- `client/src/automation/filesystem/read.js` — filesystem read not implemented
- `client/src/automation/filesystem/write.js` — filesystem write not implemented

### Dead Code
- `cloud/src/verification/goalVerifier.js` — early return prevents LLM call
- `cloud/src/verification/failureVerifier.js` — never imported
- `cloud/src/verification/eventVerifier.js` + `eventMatchers.js` — events never match
- `cloud/src/verification/stateVerifier.js` + `stateMatchers.js` — partially redundant with `objectiveVerifier.js`
- `cloud/src/world/worldModel.js` → `addFinding()` / `addEntity()` — never called

### Session Trace (from `sessions/session_youtube_gen_1.json`)
- 38 attempts to "play first video of react on youtube"
- TypeExecutor: 28 executions, 0 successes (could not type into search box)
- NavigationExecutor: 6 executions, 6 successes (navigated successfully but could not proceed)
- 30+ identical transition records showing agent stuck in loop between `generic.com` and `google.com`
- Demonstrates the agent can navigate but fails at typed interaction and cannot make progress toward goals

### Architectural Tensions
- **Global mutable state** in browser.js and WebSocket server
- **No request correlation** in WebSocket protocol (no requestId)
- **Single client** limitation (one connected client at a time)
- **No timeout** on pending execution results
- **Memory scans full table** on every retrieval (no WHERE clause)
- **Observer overwrites pageState** for PRESS_KEY actions (creates fake stub)
- **Action generation still has site-specific references** despite attempts to generalize (YouTube search, GitHub search hardcoded in `actionGenerator.js`)
- **Goal decomposition** uses generic fallback when LLM fails
- **Sub-objective advancement** is heuristic and fragile (URL + page purpose matching)
- **No cross-platform adapter pattern** — executor directly imports browser vs desktop

---

## File Count

**Cloud (`cloud/src/`):** 60+ JS files across agent, reasoning, verification, world, memory, LLM, research, capabilities, prompts, humanLoop, plugins, connectors

**Client (`client/src/`):** 40+ JS files across executor, observer, automation/browser (~35 files), automation/desktop, automation/terminal, automation/filesystem, registry, connectors, schemas

---

## Summary

Kairos has a solid architecture (cloud/client split, WebSocket bridge, Playwright-based browser automation) with advanced features (goal decomposition, LLM action selection, verification, recovery, memory). The browser automation layer is the most mature component. Desktop automation, terminal, and filesystem are stubs. The verification system has significant dead code from refactoring. The agent loop is functional but shows reliability issues in practice (38-attempt loops on simple goals). The codebase is actively evolving with recent additions like adaptive recovery, context compression, plugin system, and resource allocation.
