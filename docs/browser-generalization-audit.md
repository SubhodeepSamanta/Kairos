# Kairos Browser Generalization Audit

This document identifies all platform, URL, goal, and verification assumptions in the Kairos codebase, along with strategies to replace them with generalized reasoning.

## Platform-specific assumptions

### youtube
- **Files & Lines**: 
  - [stateNormalization.js:L2-5](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/stateNormalization.js#L2-5), [L113](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/stateNormalization.js#L113), [L121](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/stateNormalization.js#L121)
  - [currentStateResolver.js:L81](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L81), [L96](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L96), [L104](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L104)
  - [objectiveVerifier.js:L72](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L72)
  - [actionSelector.js:L74](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionSelector.js#L74)
  - [actionGenerator.js:L3](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L3), [L13](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L13), [L25](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L25)
- **Why it exists**: To normalize page states for YouTube (home, results, video playing) and handle youtube-specific search/media flows.
- **Replacement strategy**: Use the `goalUnderstanding` module to determine if the objective is `consume media`. Use `pageUnderstanding` to identify if the current page features a media player (based on semantic components, ARIA tags, and media capabilities) without naming the domain.

### github
- **Files & Lines**: 
  - [currentStateResolver.js:L80](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L80), [L104](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L104)
  - [objectiveVerifier.js:L72](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L72)
  - [actionSelector.js:L74](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionSelector.js#L74)
  - [actionGenerator.js:L2](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L2), [L13](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L13), [L24](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L24)
- **Why it exists**: To direct search query extraction and handle GitHub repository navigation.
- **Replacement strategy**: Map search elements using affordances (`typeable`, `clickable` elements with search roles). Avoid stripping platform prefix via regex; instead, use semantic entities from `goalUnderstanding`.

### amazon, google, wikipedia, reddit, linkedin
- **Files & Lines**:
  - [currentStateResolver.js:L78-89](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L78-89), [L104](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L104)
  - [objectiveVerifier.js:L72](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L72)
  - [actionSelector.js:L74](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionSelector.js#L74)
  - [actionGenerator.js:L1-10](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L1-10), [L13](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L13)
- **Why it exists**: Standard lists of domains to parse and map to target navigation behaviors.
- **Replacement strategy**: Parse direct navigation targets or domain indicators dynamically using NLP or generalized URL pattern matching, without hardcoding lists of sites.

---

## URL-specific assumptions

- **`contains("/watch")`**, **`contains("/shorts")`**:
  - **Files & Lines**: [currentStateResolver.js:L18](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L18), [L145-147](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L145-147), [objectiveVerifier.js:L48](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L48)
  - **Why it exists**: Checks if a URL represents a video page.
  - **Replacement**: Use `pageUnderstanding` to identify video content based on interactive video elements (e.g. `<video>` tags, play buttons, media controls) or semantic role mappings.
- **`contains("/search")`**, **`contains("/results")`**:
  - **Files & Lines**: [currentStateResolver.js:L29](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L29), [L36](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L36), [L187](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L187), [pageUnderstanding.js:L86](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/pageUnderstanding.js#L86)
  - **Why it exists**: Identifies if a page is a search results page.
  - **Replacement**: Detect based on page purpose (e.g., presence of search input, query params in URL generally, list of result items, semantic categories of child elements).
- **`contains("/login")`**, **`contains("/signin")`**, **`contains("/auth")`**:
  - **Files & Lines**: [currentStateResolver.js:L37](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js#L37), [pageUnderstanding.js:L81](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/pageUnderstanding.js#L81)
  - **Why it exists**: Identifies if the user is on a login page.
  - **Replacement**: Search for forms containing username/password input fields or labels with authentication keywords.

---

## Goal-specific assumptions

- **Goal contains "play", "video", "music"**:
  - **Files & Lines**: [objectiveVerifier.js:L27](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L27), [actionGenerator.js:L32](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L32)
  - **Why it exists**: Determines if the goal involves media streaming.
  - **Replacement**: Translate goal semantics to `objective: "consume_media"` using the V2 goal understanding module.
- **Goal contains "search", "find"**:
  - **Files & Lines**: [objectiveVerifier.js:L28](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L28)
  - **Why it exists**: Classifies goal as search-based.
  - **Replacement**: Translate to `objective: "search_content"`.
- **Goal contains "extract", "get", "retrieve"**:
  - **Files & Lines**: [objectiveVerifier.js:L26](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L26), [actionGenerator.js:L158](file:///c:/Users/USER/Desktop/Kairos/cloud/src/reasoning/actionGenerator.js#L158)
  - **Why it exists**: Classifies goal as extraction-based.
  - **Replacement**: Translate to `objective: "extract_information"`.

---

## Verification assumptions

- **Goal verification depends on platform, URL matching or page type matching**:
  - **Files & Lines**: [objectiveVerifier.js:L40-42](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L40-42), [L48](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L48), [L56](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L56), [L64](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L64), [L72-79](file:///c:/Users/USER/Desktop/Kairos/cloud/src/verification/objectiveVerifier.js#L72-79)
  - **Why it exists**: Verifies goal completion based on whether url/title matches the site name or specific pattern.
  - **Replacement**: Require objective-based evidence verification (e.g. check if media element is present, check if query results are rendered, check if credentials were submitted and authentication token/state is changed, or data extraction actually retrieved the requested payload).
