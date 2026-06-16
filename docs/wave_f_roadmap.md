# Wave F: Skill Router & Specific Skills

## Vision
With Wave E (Semantic Observer) complete, the agent can recognize page types and element purposes locally and cheaply. Wave F builds the **Skill Router** and thin, page-specific **Skills**. 

Instead of generating raw browser actions (click element #3, type into element #7) via the main LLM planner, the planner delegates domain-specific goals to a registered page skill.

---

## Roadmap

### F1: Skill Router
Detects if a matching Skill exists for the active `pageType`.
- **Inputs**: `pageType`, `intent`.
- **Execution**: If `pageType` matches (e.g. `youtube_video`), intercept standard planning and hand off control to `YouTubeSkill`.

### F2: YouTube Skill
Automates interactions on YouTube using semantic tags:
- Search: Click `search_input`, type query, press Enter.
- Play video: Find first video item link/button, click it.
- Control player: Fast forward, mute, play/pause using `media_control`.

### F3: GitHub Skill
Automates GitHub flows:
- Search: Input search term into GitHub search box.
- Explore repository: Click code tab, clone button, issue tracker, etc.

### F4: Google Skill
Automates Google searches:
- Execute query: Find google search input, type query, hit search.
- Link selection: Navigate organic search results.

---

## Benefits
- **Super Fast**: Execution script runs directly on semantic elements without consulting the central LLM planner for intermediate actions.
- **Ultra Cheap**: Drastically reduces LLM planning calls during navigation and execution steps.
- **Reliable**: Decoupled from class names or raw DOM locations.
