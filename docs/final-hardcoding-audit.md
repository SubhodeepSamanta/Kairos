# Final Hardcoding Audit

This document audits the codebase to trace the elimination of platform/website-specific assumptions in favor of semantic, website-agnostic logic.

## Removed Website Assumptions

| File | Removed Code / Check | Justification | Generic Replacement |
| :--- | :--- | :--- | :--- |
| `elementClassifier.js` | Classifications like `video_link`, `product_link`, `post_link`, `jobs_link`. | Violates Rule 2 (platform-specific classifications). | Classified as generic semantic categories: `primary_content`, `content_item`, `selection_candidate`. |
| `pageClassifier.js` | Hardcoded website URLs mapping (`google.com`, `youtube.com`, `amazon.com`, `linkedin.com`, `reddit.com`) and page checks like `isYoutubeResults`. | Violates Rule 1 (identifying websites by name during reasoning). | Generic page classification purposes (like `search results`, `media content`, `product detail`, `form`, `settings`, `profile`, `listing page`). |
| `currentStateResolver.js` | Hostname matching mapping to hardcoded platform names and checking `youtu` / `youtube`. | Violates Rule 1 (relying on platforms to drive decisions). | Resolved environments dynamically based on metadata keywords. Extracted platform name as metadata only from the pageType delimiter structure. |
| `currentStateResolver.js` | Hardcoded `/watch`, `/live`, `/shorts` URL links inside `hasResultLinks` check. | Violates Rule 3 (url containment validation). | Checks if links match result semantic types: `primary_content`, `content_item`, or `selection_candidate`. |
| `stateNormalization.js` | Hardcoded platform checks (`youtube`) and platform-specific transition checks. | Violates Rule 1 & 4. | Unified capability transitions using generic regex matching for media markers on normalized state names. |
| `objectiveVerifier.js` | Checked pageType `/watch`, `/shorts`, `video_playing` or specific platform URL contains for verify. | Violates Rule 3 (verification must check evidence, not platform assumptions). | Evidence checks: checked capabilities (`media_active`, `media_playing`) and generic page classifications (`media content`, `search results`). |

## Retained Website Assumptions

| File | Retained Code / Check | Justification |
| :--- | :--- | :--- |
| `diagnoser.js` | Alternate recovery url `https://www.google.com`. | Simple fallback search engine gateway to restore page context; does not affect target page reasoning. |
| `memory/extract.js` | Prompt examples containing `my github is subhodeep123`. | Examples provided in system instructions for the LLM extraction parser; does not drive agent routing or decisions. |
