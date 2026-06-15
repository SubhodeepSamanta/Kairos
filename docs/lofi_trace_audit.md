# "Open YouTube and play a lofi video" Trace Audit & Diagnosis

This document diagnoses the execution behavior of the YouTube lofi playback test case. It traces the data flows, computes token sizes, audits verifiers, and pinpoints the exact breakpoint.

---

## 1. Step-by-Step Execution Trace

| Step | Task | Intent | Planned Action | Outcome / Observation | Verification Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Open YouTube homepage | `navigate` | `navigate("https://youtube.com")` | URL matches `youtube.com`. Title = `YouTube`. | **PASS** (programmatic `matchNavigation` succeeds) |
| **2** | Search lofi on YouTube | `type` | `type("lofi")` | Search field contains `"lofi"`. URL same. | **PASS** (types text; matchFormFill returns `null` because of "search" keyword exclusion, planner then presses Enter, result URL changes, LLM verifier passes) |
| **3** | Open a lofi video from results | `click` | `click(elementId)` (target video) | Click resolves. New tab opens. | **FAIL** (New tab observed, but details below show verifier breakdown) |

---

## 2. Token Size Audit (Post-Optimization)

Character counts for prompt templates under the optimized model (after element capping and history trimming):

* **Planner Prompt (system + user):**
  * *System Prompt:* ~3,200 chars
  * *Browser Context (capped to 10 inputs / 20 buttons / 20 links):* ~1,800 chars
  * *User Prompt (browserState + task):* ~1,500 chars
  * **Total Size:** **~6,500 chars (~1,600 tokens)**
* **Replanner Prompt (system + user):**
  * *World State Summary:* ~1,200 chars (Down from 50k+)
  * *Observations (last 3):* ~2,200 chars
  * **Total Size:** **~6,600 chars (~1,650 tokens)**
* **Task Verifier Prompt (system + user):**
  * *System Prompt:* ~1,800 chars
  * *User Prompt (browserState + world):* ~2,000 chars
  * **Total Size:** **~3,800 chars (~950 tokens)**
* **Goal Verifier Prompt:**
  * **Total Size:** **~2,800 chars (~700 tokens)**

---

## 3. Verifier Audit for playback step

At the critical video-playback step (Task 3), the verifier evaluation results are:

| Verifier | Status / Return Value | Reason |
| :--- | :--- | :--- |
| **`stateVerifier`** | `null` | No matching programmatic rules exist for media play state. |
| **`eventVerifier`** | `null` | No hardcoded media-start events detected. |
| **`ruleVerifier`** | `null` | No simple page-load rules apply. |
| **`taskVerifier` (LLM)** | `achieved: false` | Success criteria requires "video is playing or ready to play". Prompt rules state: *"Never infer. Never assume. If evidence is missing, achieved=false."* |
| **`goalVerifier` (LLM)** | `achieved: false` | Falls back to false since Task 3 failed. |

---

## 4. World Model Footprint Audit

* **Average size of `goal.world` after 3 steps:**
  * *Pre-Optimization:* **~45,000 chars** (storing raw element arrays for every state trace).
  * *Post-Optimization:* **~3,500 chars** (only storing URL and Title history).
* **Usage by Planner:** The planner only consumes `goal.world.lastAction`, `goal.world.lastOutcome`, `goal.world.lastUrl`, and `goal.world.lastTitle` (~500 chars of utility). 90%+ of the old world model was sent as dead weight.

---

## 5. The Single Most Important Question: Where is the break point?

The verification chain breaks at **Task 3 Verification** ("Open a lofi video from results").

### The Breakpoint Scenario:
1. **Task 3 Goal:** "Open a lofi video from results" (with successCriteria: *"video page is open"*, *"video is playing or ready to play"*).
2. **Action Taken:** Agent clicks the target video link.
3. **Outcome:** A new tab loads `https://www.youtube.com/watch?v=...`.
4. **Scraped Observation:** `readPage()` extracts page HTML text, inputs, buttons, and links.
5. **Verifier Failure:** 
   * Playwright is blind to active media state. The client observation only returns DOM elements (buttons like Play/Pause, text titles) but no property stating `isPlaying: true`.
   * The strict `taskVerifier` prompt instructs: *"A task is achieved ONLY if ALL criteria are met... If uncertain, return achieved=false"*.
   * Because there is no direct evidence confirming "video is playing" (only buttons that *could* control it), the LLM plays safe and returns `achieved: false`.
   * **Result:** The agent enters a loop, clicking the video link again or requesting `read_ui` to search for proof.
