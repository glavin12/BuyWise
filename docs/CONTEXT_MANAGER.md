# Context Manager

The Context Manager is responsible for assembling the AI agent's working memory before every invocation. It is **not** an agent, planner, or financial reasoning component.

Read this when adding a new context module, changing how context reaches the LLM, or integrating a future system (memory, summaries, planner).

---

## Philosophy — Hybrid Context Strategy

The system does **not** preload every piece of user data before every request. It also does **not** start with zero context.

```
Small Base Context
        +
Just-in-Time Tool Retrieval
        =
Hybrid Context Strategy
```

Every conversation begins with a lightweight **Base Context** (cheap, universally useful). The agent then progressively discovers additional information through tools. This keeps token usage low while still giving the agent immediate awareness of who the user is.

---

## Architecture

```
                User Query
                     │
                     ▼
           Context Manager
                     │
      Build Base FinancialContext
                     │
                     ▼
           [SystemMessage] + recent messages
                     │
                     ▼
                  LLM Agent
                     │
         ┌───────────┴───────────┐
         │                       │
      Answer                   Tool Call
                                 │
                                 ▼
                           Tool Result
                         (injected by agent)
```

The Context Manager sits **between ChatService and the agent**. It produces a `FinancialContext`, which is rendered as a `SystemMessage` and prepended to the conversation history before `invoke_agent` is called.

---

## Data Flow (per request)

```
ChatService.send_message()
  │
  ├─ context_mgr.build_context(user_id, conversation_id)
  │    ├─ ProfileLoader.load()       → ProfileService → ProfileRepository → DB
  │    └─ TimeLoader.load()          → datetime.now(UTC)
  │    └─ FinancialContext(...)
  │
  ├─ ctx.to_langchain_messages()
  │    └─ [SystemMessage(content="[CONTEXT]\n- User: ...\n- Current date: ...")]
  │
  ├─ all_messages = context_messages + recent_messages
  │
  └─ invoke_agent(all_messages)
       └─ create_react_agent(prompt=SYSTEM_PROMPT, ...)
              Static instructions stay put.
              Dynamic context arrives as a SystemMessage.
```

---

## Package Structure

```
ai_service/context/
    __init__.py              Public exports
    models.py                FinancialContext, ContextModule, ContextSession
    base_context.py          ContextLoader ABC
    manager.py               ContextManager — orchestration
    loaders/
        __init__.py
        profile_loader.py    Reads Profile via ProfileService
        time_loader.py       Produces current UTC date
```

---

## Models

### `ContextModule` (frozen dataclass)

```python
@dataclass(frozen=True)
class ContextModule:
    name: str       # "profile", "current_time", "memory", "summary"
    content: str    # human/LLM-readable single-line text
```

### `FinancialContext` (frozen dataclass)

Immutable snapshot built once per turn. The agent receives this — never mutates it.

```python
@dataclass(frozen=True)
class FinancialContext:
    profile: ContextModule | None
    current_time: ContextModule | None
    loaded_modules: frozenset[str]

    def to_system_message_content(self) -> str: ...
    def to_langchain_messages(self) -> list[SystemMessage]: ...
```

`loaded_modules` tracks which modules were loaded so future phases can avoid redundant retrieval.

### `ContextSession` (mutable dataclass, future use)

Reserved for persistent between-turn context tracking. Not wired yet — V1 rebuilds context fresh per request. When persistence lands (future phase), `loaded_modules` and cached tool results will live here across HTTP requests.

---

## Loader Contract

```python
class ContextLoader(ABC):
    @abstractmethod
    async def load(self, user_id: UUID, session: AsyncSession) -> ContextModule: ...
```

Each loader is self-contained:
- Receives `user_id` and `session` explicitly — does NOT rely on `request_context()` contextvars.
- Creates whatever service it needs internally (e.g. `ProfileService(session)`).
- Returns a `ContextModule` with a unique `name` and a compact `content` string.

Loaders are registered explicitly in `ContextManager._loaders`. No auto-discovery.

---

## What the LLM Sees

Base context is rendered as a single compact `SystemMessage` with bullet formatting:

```
[CONTEXT]
- User: Bhagy | Currency: INR | Timezone: Asia/kolkata | Income: salaried (salary day: 1) | Savings target: 100%
- Current date: 2026-08-07 (UTC)
```

This `SystemMessage` is prepended to the conversation history, **after** the static `SYSTEM_PROMPT` (which is still injected by `create_react_agent(prompt=SYSTEM_PROMPT)`). The LLM receives both, in order:
1. Static prompt (agent identity, rules, tool guide)
2. Dynamic context `SystemMessage` (profile, date)
3. Conversation history (user/assistant/tool messages)

---

## Current Modules (V1)

| Loader | Source | Fallback |
|--------|--------|----------|
| `ProfileLoader` | `ProfileService.get_profile(user_id)` → DB | `"New user — profile not yet configured."` |
| `TimeLoader` | `datetime.now(timezone.utc)` | Never fails (no DB) |

---

## Non-negotiable Rules

1. **Context Manager is NOT an agent.** It assembles context; it does not reason, plan, or make decisions.
2. **Loaders are self-contained.** Each loader owns its service dependencies. The manager never imports financial services directly.
3. **Base context is injected via SystemMessage, not by mutating the system prompt.** The static `SYSTEM_PROMPT` in `agent_service.py` is untouched.
4. **Never preload expensive data.** Transactions, budgets, goals, spending analytics — these belong to tools, never to base context.
5. **Loaders receive explicit args** (`user_id`, `session`), not contextvars. They run outside `request_context()`.

---

## How to Add a New Context Module

1. Create a loader in `ai_service/context/loaders/` implementing `ContextLoader`.
2. Add a field to `FinancialContext` for the new module.
3. Update `FinancialContext.to_system_message_content()` to render it.
4. Register the loader in `ContextManager._loaders`.

Example for Phase 2 memory:

```python
# loaders/memory_loader.py
class MemoryLoader(ContextLoader):
    async def load(self, user_id, session) -> ContextModule:
        svc = MemoryService(session)
        facts = await svc.get_facts(user_id)
        if not facts:
            return ContextModule(name="memory", content="No memory facts stored yet.")
        return ContextModule(name="memory", content=" | ".join(facts))

# models.py — add field
class FinancialContext:
    memory: ContextModule | None = None  # NEW

# manager.py — register
self._loaders = [
    ProfileLoader(),
    TimeLoader(),
    MemoryLoader(),  # NEW
]
```

---

## Future Integration Points

| Phase | What plugs in |
|-------|--------------|
| Phase 2 (Memory) | `MemoryLoader` — long-term user facts |
| Phase 4 (Summaries) | `SummaryLoader` — conversation summarization |
| Between-turn merge | `ContextSession` persistence + dynamic module accumulation |
| Planner | Pre-load likely-needed modules based on query classification |

---

## Design Decisions

See `docs/DESIGN_DECISIONS.md` §12 for the rationale behind the hybrid strategy and the choices made during implementation.
