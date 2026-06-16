# Wave E: Semantic Understanding Layer

## Context & Vision
Kairos is transitioning from observing raw DOM structures to understanding page semantics. Instead of the LLM Planner receiving raw DOM elements and guessing their intent (e.g., mistaking a signup input for a search input), we insert a **Deterministic Semantic Observer** layer between the DOM extraction and the Planner.

```text
DOM → Semantic Observer → Compressed State → Planner
```

This layer must be:
- **Fast**
- **Deterministic** (Regex, element attributes, labels, DOM hierarchy)
- **Cheap & Local** (No LLM for element classification)

---

## Roadmap

### E1: Semantic Element Classification
Implement local, deterministic classifier `classifyElement(element)` returning element purpose and confidence score.
- **Input**:
  ```json
  { "id": 17, "role": "input", "placeholder": "Search GitHub" }
  ```
- **Output**:
  ```json
  { "id": 17, "role": "input", "purpose": "search_input", "confidence": 0.98 }
  ```
- **Common Purposes**: `search_input`, `signup_email`, `login_button`, `navigation_button`, `media_control`.

### E2: Page Classification
Classify current page type using URL, Title, and key visible controls.
- **Examples**: `github_home`, `github_search_results`, `youtube_video`, `youtube_results`.
- **Execution**: Run before planner to set high-level page context.

### E3: Context Compression
Reduce planner input tokens by mapping page type to specific primary controls.
- **Example State Sent to Planner**:
  ```json
  {
    "pageType": "youtube_results",
    "searchInputs": [{ "id": 2 }],
    "primaryResults": [{ "id": 17 }, { "id": 21 }, { "id": 26 }],
    "actions": ["search", "open_video"]
  }
  ```

### E4: Observation Quality Score
Add validation on DOM read to detect incomplete/broken page states.
- **Output**:
  ```json
  { "quality": 0.91, "reasons": [] }
  ```
- **Flow**: If quality is low, trigger `Read Again` instead of `Replan`.

---

## Future Waves

### Wave F: Skill Router & Specific Skills
Build thin website-specific skills utilizing semantic selectors.
- **F1**: Skill Router
- **F2**: YouTube Skill
- **F3**: GitHub Skill
- **F4**: Google Skill

### Wave G: Advanced Execution
- **G1**: Hierarchical Planner
- **G2**: Capability Graph
- **G3**: Strategy Layer
