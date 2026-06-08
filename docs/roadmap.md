# Kairos Roadmap

## Vision

Kairos is a personal AI agent with two components:

* Cloud (planning, research, memory, messaging)
* Client (automation, execution, observation)

Architecture:

User → Cloud → Planner → Client → Executor → Observer → Cloud

The long-term goal is a self-improving assistant capable of:

* Chat
* Research
* Desktop automation
* Memory
* Replanning
* Voice
* Multi-platform support

---

# Current Status

## Phase 1 - Foundation

### 1.1 Schemas

Status: Complete

* Goal schema
* Plan schema
* Action schema
* Observation schema
* Task schema

### 1.2 Planner

Status: Complete

* LLM planner
* Groq integration
* Provider abstraction

### 1.3 Executor

Status: Complete

* open_app
* close_app

### 1.4 Observer

Status: Complete

* Running state verification
* Closing verification

### 1.5 Communication

Status: Complete

* WebSocket server
* WebSocket client
* Cloud → Client execution
* Client → Cloud observations

### 1.6 Telegram

Status: Complete

* Telegram control
* Agent execution from Telegram

---

# Phase 2 - Intelligence Layer

## 2.0 Router

Status: Complete

Routes messages into:

* Chat
* Agent
* Research

## 2.1 LLM Planning

Status: Complete

Removed keyword-based planner.

Uses:

* Groq
* OpenRouter fallback (pending)
* NVIDIA fallback (pending)

## 2.2 Actions

Status: In Progress

Completed:

* open_app
* close_app

Pending:

* focus_app

Reason:
Current implementation is placeholder only.

Return in:
Phase 4

---

## 2.2B Dynamic App Registry

Status: Deferred

Goal:

Open and manage installed apps without hardcoded lists.

Examples:

* Spotify
* VS Code
* Discord
* Steam
* OBS

Reason:

Needs proper registry/process mapping.

Return in:
Phase 4

---

## 2.3 Research Brain

Status: Next

Goal:

Support:

* Latest AI news
* Research summaries
* Deep research
* Web search
* Web extraction

Planned modules:

* Search
* Extract
* Summarize
* Research Pipeline

---

## 2.4 Memory

Status: Planned

Storage:

Local SQLite

Store:

* User preferences
* Preferred browser
* Preferred music app
* Installed apps cache
* Recent tasks

---

## 2.5 Replanner

Status: Planned

Goal:

Observe failures.

Automatically generate alternative plans.

Example:

Open Spotify
↓
Fail
↓
Open Spotify Web
↓
Success

---

# Phase 3 - Assistant Layer

Status: Planned

Features:

* Rich chat
* Personality
* Conversation history
* User preferences
* Better responses

Deferred Item:

Rich Chat Personality

Reason:

Needs memory first.

---

# Phase 4 - Automation Perfection

Status: Planned

Features:

* Dynamic App Registry
* Real focus_app
* Better UIA
* Better application detection

Deferred Items:

* Dynamic Registry
* focus_app

---

# Phase 5 - Voice & Ecosystem

Status: Planned

Features:

* STT
* TTS
* Voice conversations
* Discord
* WhatsApp
* Additional connectors

---

# Technical Rules

Never add a new action type unless:

* Planner supports it
* Executor supports it
* Observer supports it

Never leave partial implementations.

Every deferred feature must be added to this roadmap.

Every phase must be completed before starting unrelated work.

---

# Current Next Step

Phase 2.3

Research Brain
Research Modes

Cloud Research
- Works when client offline
- Search
- Extract
- Summarize

Deep Research
- Requires client online
- Browser automation
- Multi-page extraction
- Documentation analysis
- Long-form reports

Phase 2.3 Research Brain
Status: In Progress

Completed:
- Search
- Extract
- Summarize

Phase 2.3 Research Brain

Completed:
- Search
- Extract
- Summarize
- Multi-source aggregation
- Deduplication

Phase 2.3
Status: Complete (Cloud Research V1)

Completed:
- Search
- Extract
- Summarize
- Multi-source aggregation
- Deduplication
- Citations
- Telegram formatting

Phase 2.3D
Research Stabilization

Status: Current

Tasks:
- Fix router classification
- Fix formatting
- Improve weather routing
- Improve research detection