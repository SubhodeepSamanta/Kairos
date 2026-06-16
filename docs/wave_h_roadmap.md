# Wave H: Modular Prompt Architecture

## Vision
Prevent system prompts from becoming monolithic "God Prompts". Decouple prompts into highly focused, domain-specific modules. Build prompts dynamically based on active task context (domain, page type, tab layout, memory requirements).

```text
Planner (Orchestrator/Executor)
   ↓
Prompt Assembler (Gathers modules dynamically)
   │
   ├── Core Modules (Output rules, action schemas)
   ├── Domain Modules (Browser rules, desktop rules, terminal rules)
   └── Feature Modules (Multi-tab rules, recovery rules, extraction rules)
```

---

## Roadmap

### H1: Directory Restructuring
Create clean directories under `cloud/src/planner/prompts/`:
- `core/`: Core behavior, formatting constraints, output rules.
- `domains/`: Domain rules (browser vs. desktop vs. terminal).
- `features/`: Specific prompt capabilities (multi-tab, data extraction, memory reference).

### H2: Prompt Modules
Extract guidelines from the monolithic prompt into independent files:
- `core.js`: Formatting, loop actions rule.
- `browser.js`: URL, page reading guidelines.
- `multitab.js`: Tab switches.
- `video.js`: Video search / play guidelines.

### H3: Dynamic Prompt Assembler
Refactor `systemPrompt.js` into an assembler that:
1. Always includes core modules.
2. Intercepts task domain (browser, desktop, terminal) to append domain prompts.
3. Inspects browser state (e.g. if `activeTab` URL contains YouTube) to append specific website prompts.
4. Checks tab counts and adds multi-tab modules if needed.
