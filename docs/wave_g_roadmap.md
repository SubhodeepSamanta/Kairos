# Wave G: Advanced Execution Layer

## Vision
Wave G introduces structured hierarchical control. Instead of a single LLM planning loop that handles both high-level task ordering and low-level DOM selector execution, Wave G decouples these concerns. This matches systems like OpenClaw, Hermes, and Manus.

```text
User Goal
   ↓
Hierarchical Planner (Orchestrator - plans abstract sub-goals)
   ↓
Capability Graph (Routes sub-goals to matched devices/skills)
   ↓
Strategy / Skill Layer (Executes low-level browser actions)
```

---

## Roadmap

### G1: Hierarchical Planner
Splits the agent loop into two nested roles:
- **Orchestrator**: Maintains the high-level Task Graph. Understands the overall goal and manages milestones (e.g., "Authenticate on GitHub" -> "Create Repository" -> "Push Code"). Does not look at DOM coordinates or element IDs.
- **Executor**: Takes a single high-level milestone and coordinates device adapters or Skill code. Executes steps (clicks, typing) to complete the sub-goal.

### G2: Capability Graph
An registry mapping of available skills, page classifiers, and system device actions.
- **Dynamic Routing**: The Orchestrator queries the Capability Graph to resolve how to fulfill a task (e.g. "We need to search. Page is google.com. Routing search query to GoogleSkill").
- **Graceful Fallbacks**: If a website has no matching Skill, the Capability Graph routes the sub-goal to a generic LLM-based web-navigation executor.

### G3: Strategy Layer
A safety and optimization layer that monitors task execution paths:
- **Failure Recovery**: Switches tactics if a particular plan is stuck (e.g., if Google Search fails, switch to Yahoo Search).
- **Anti-Bot Avoidance**: Modifies execution speed, waits, and scrolling behaviors to mimic human users when page blockers are encountered.
