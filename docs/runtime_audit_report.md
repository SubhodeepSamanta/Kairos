# Runtime Audit Report: Wave E, F, G

This report traces the execution paths for the requested test cases, identifies root causes of failures, loops, and LLM fallbacks, and ranks the required fixes.

---

## 1. Execution Chain Trace Matrix

### Test Case 1: `search github for react`
* **GOAL**: `Search for react on GitHub`
* **TASK GRAPH**:
  1. Task 1: "Open GitHub homepage" (successCriteria: `URL contains github.com`)
  2. Task 2: "Search for react on GitHub" (successCriteria: `Search input contains react`, `Search results are visible`)
* **CURRENT TASK**: Task 1 (Turn 1) -> Task 2 (Turn 2+)
* **ROUTER INPUT**:
  - Turn 1: `pageType: "generic"`, `url: "about:blank"`
  - Turn 2: `pageType: "github_home"`, `url: "https://github.com/"`
* **SKILL MATCH RESULT**:
  - Turn 1: `null` (Bypassed to LLM Planner)
  - Turn 2: `GitHubSkill` matches
* **SKILL ACTIONS**:
  - Turn 1: LLM Planner returns `navigate` to `https://github.com`
  - Turn 2: `GitHubSkill.execute` looks for `searchInput`. Since `inputs.slice(0, 10)` is enforced, the search input (ID 74) is sliced out and not present in `browserState.inputs`.
  - `GitHubSkill.execute` falls back to `searchBtn` (ID 72) and returns `[{ "type": "click", "params": { "element": 72 } }]`.
* **EXECUTOR PAYLOAD**: `[{ "type": "click", "params": { "element": 72 } }]`
* **CLIENT OBSERVATION**:
  - Playwright click on element 72 fails (30s timeout) because the command palette input overlay is already open in the browser and intercepts all pointer events.
  - Result: `success: false`, `reason: "locator.click: Timeout 30000ms exceeded"`.
* **WORLD MODEL UPDATE**: Caches the failed observation. Since `pageState` is absent in failed observations, the current page type is resolved as `""` (empty string).
* **STATE VERIFIER**: Skips state verification (allSucceeded is false).
* **EVENT VERIFIER**: Skips event verification (allSucceeded is false).
* **REPLANNER**: Invoked because task is not achieved and execution failed.
* **NEXT ACTION**: Bypasses skill (blacklisted due to failure) -> falls back to LLM Replanner.

---

### Test Case 2: `search youtube for lofi`
* **GOAL**: `Search for lofi on YouTube`
* **TASK GRAPH**:
  1. Task 1: "Open YouTube homepage"
  2. Task 2: "Search for lofi videos on YouTube"
* **CURRENT TASK**: Task 1 -> Task 2
* **ROUTER INPUT**:
  - Turn 1: `pageType: "generic"`, `url: "about:blank"`
  - Turn 2: `pageType: "youtube_home"`, `url: "https://www.youtube.com/"`
* **SKILL MATCH RESULT**:
  - Turn 1: `null` (LLM Planner)
  - Turn 2: `YouTubeSkill` matches
* **SKILL ACTIONS**:
  - Turn 1: `navigate` to `https://www.youtube.com`
  - Turn 2: `YouTubeSkill.execute` extracts "lofi". Finds `searchInput` (YouTube homepage has < 10 inputs). Returns `[{ type: "type", params: { element: searchInput.id, text: "lofi" } }, { type: "press_key", params: { key: "Enter" } }]`
* **EXECUTOR PAYLOAD**: The array of 2 actions.
* **CLIENT OBSERVATION**: `success: true` for both actions. Page navigates to `/results?search_query=lofi`.
* **WORLD MODEL UPDATE**: Caches new state `youtube_results`.
* **STATE VERIFIER**: Matches URL against success criteria.
* **EVENT VERIFIER**: Confirms navigation event.
* **REPLANNER**: Not invoked (Task 2 completed).
* **NEXT ACTION**: Goal finished successfully.

---

### Test Case 3: `play a lofi video on youtube`
* **GOAL**: `Play a lofi video on youtube`
* **TASK GRAPH**:
  1. Task 1: "Open YouTube homepage"
  2. Task 2: "Search for lofi videos on YouTube"
  3. Task 3: "Open a lofi video from search results"
* **CURRENT TASK**: Task 3 (after successful navigation to results)
* **ROUTER INPUT**: `pageType: "youtube_results"`, `url: "https://www.youtube.com/results?search_query=lofi"`
* **SKILL MATCH RESULT**: `YouTubeSkill` matches
* **SKILL ACTIONS**:
  - Looks for a link containing `/watch` in `browserState.links`.
  - **Risk**: If search result links are low in the DOM and links array is capped to 20, they might get sliced out.
  - If found: returns `[{ type: "click", params: { element: videoLink.id } }]`
* **EXECUTOR PAYLOAD**: `[{ type: "click", params: { element: videoLink.id } }]`
* **CLIENT OBSERVATION**: `success: true`. Video begins playing.
* **WORLD MODEL UPDATE**: Page state is updated to `youtube_video`.
* **STATE/EVENT VERIFIERS**: Programmatic verifiers match `watch` URL and confirm achievement.
* **REPLANNER**: Goal completed.
* **NEXT ACTION**: Finished.

---

### Test Case 4: `search amazon for headphones`
* **GOAL**: `Search amazon for headphones`
* **TASK GRAPH**:
  1. Task 1: "Open Amazon homepage"
  2. Task 2: "Search amazon for headphones"
* **CURRENT TASK**: Task 2 (on `amazon_home`)
* **ROUTER INPUT**: `pageType: "amazon_home"`, `url: "https://www.amazon.com/"`
* **SKILL MATCH RESULT**: `AmazonSkill` matches
* **SKILL ACTIONS**:
  - Looks for `searchInput` in `browserState.inputs`.
  - **Failure Point**: Amazon home has > 10 inputs. Enforcing `inputs.slice(0, 10)` slices out the main search bar.
  - Result: `searchInput` is `undefined`. Skill returns `null` (LLM Fallback).
* **EXECUTOR PAYLOAD**: (If LLM handles it, generates standard plan).
* **CLIENT OBSERVATION**: Execution depends on LLM planner.
* **WORLD MODEL UPDATE**: Updated.
* **STATE/EVENT VERIFIERS**: Evaluated.
* **REPLANNER**: Invoked if verification fails.
* **NEXT ACTION**: Handled by LLM.

---

### Test Case 5: `search reddit for AI agents`
* **GOAL**: `Search reddit for AI agents`
* **TASK GRAPH**:
  1. Task 1: "Open Reddit homepage"
  2. Task 2: "Search reddit for AI agents"
* **CURRENT TASK**: Task 2 (on `reddit_home`)
* **ROUTER INPUT**: `pageType: "reddit_home"`, `url: "https://www.reddit.com/"`
* **SKILL MATCH RESULT**: `RedditSkill` matches
* **SKILL ACTIONS**:
  - Looks for `searchInput` in `browserState.inputs`.
  - **Failure Point**: Reddit home has > 10 inputs. `inputs.slice(0, 10)` slices out the search input.
  - Result: `searchInput` is `undefined`. Skill returns `null` (LLM Fallback).
* **EXECUTOR PAYLOAD**: Bypassed to LLM.
* **CLIENT OBSERVATION**: Execution depends on LLM.
* **WORLD MODEL UPDATE**: Updated.
* **STATE/EVENT VERIFIERS**: Evaluated.
* **REPLANNER**: Invoked.
* **NEXT ACTION**: Handled by LLM.

---

## 2. Layer Audit Findings

### 1. Skill Router
* **matched/failed**: Skill matches correctly based on pageType prefix. However, execution fails internally because required elements (like `searchInput`) are missing from the `browserState` payload.
* **canHandle()**: Works as expected (prefix matching).

### 2. Skill Execution
* **Actions Valid**: Yes, `type` and `press_key` schemas are valid.
* **Parameters**: Parameter names are correct.
* **Reaching Executor**: Yes, sent correctly via websocket.

### 3. Executor
* **Execution**: Actions are executed.
* **Schema Mismatch**: None.

### 4. Observation Layer
* **pageType**: Correctly classified.
* **purposes**: Classifications are correct.
* **Element IDs**: Correctly preserved.
* **Aggressive Slicing (Root Cause)**: `inputs.slice(0, 10)` and `buttons.slice(0, 20)` in `read.js` are too aggressive. Slices out critical elements like search inputs on large/complex sites (GitHub, Amazon, Reddit).

### 5. World Model
* **State Loss**: No.
* **Truncation**: No.
* **Active State**: In failed observations, `pageState` was absent, leading to blank `pageType` during failure strategy lookup. Fixed via history walk-back.

### 6. Verifiersa
* **Success/Fail**: Correct.
* **Looping**: Loops occurred because failed actions on covered elements (like search button when modal is already open) kept retrying due to lack of blacklisting when `pageType` resolved as `""`.

### 7. Replanner
* **Trigger**: Invoked when task/goal verification fails.

### 8. Strategy Layer
* **Blacklisting**: Strategy layer correctly blacklists after failure now, but only if the pageType can be resolved (which was fixed via history walk-back).

---

## 3. Confirmed Issues & Ranked Fixes

| Issue | Location | Root Cause | Severity | Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Aggressive Input/Button Slicing** | [read.js](file:///c:/Users/USER/Desktop/Kairos/client/src/automation/browser/actions/read.js#L204-L207) | Capping inputs to 10 and buttons to 20 slices out search bars on heavy/dynamic pages. | **P0** | Increase inputs slice cap to 40 and buttons slice cap to 40. |
| **Missing Parameter in Click Fallback** | [click.js](file:///c:/Users/USER/Desktop/Kairos/client/src/automation/browser/actions/click.js#L29-L74) | Clicks to covered elements fail; if text/role-based fallback is triggered, it works, but the skill files themselves don't populate the `text` parameter in `click` actions. | **P1** | Update skill definitions to include `text` property in all generated click action payloads. |

### Ranking of Fixes:
1. **P0**: Increase input/button/link slice bounds in `read.js`. Slicing is the primary reason search inputs on GitHub, Amazon, and Reddit are not recognized, bypassing skills entirely.
2. **P1**: Update skill action payloads (`github.js`, etc.) to include `text` parameter in all `click` actions to ensure fallback resilience works natively.
