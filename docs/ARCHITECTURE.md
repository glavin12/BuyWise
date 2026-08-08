# Architecture

Deep-dive for anyone (human or agent) modifying the agent, chat flow, or message conversion. Start with `AGENTS.md` for the non-negotiable rules.

---

## Module map

```
ai_service/
├── main.py                      FastAPI app, router registration, lifespan
├── core/
│   ├── config.py                Pydantic Settings (env-driven)
│   ├── context.py               request_context() — user_id + session contextvars for tools
│   └── rate_limit.py            Limiter singleton + JWT-hash key function (per-user limits)
├── context/
│   ├── __init__.py               Public exports
│   ├── models.py                 FinancialContext, ContextModule, ContextSession
│   ├── base_context.py           ContextLoader ABC
│   ├── manager.py                ContextManager — builds FinancialContext per request
│   └── loaders/
│       ├── __init__.py
│       ├── profile_loader.py     Reads Profile → base context
│       └── time_loader.py        Current UTC date → base context
├── db/
│   ├── base.py                  DeclarativeBase
│   └── session.py               async engine / session factory / get_async_session
├── models/
│   ├── conversation.py          Conversation, Message, MessageRole, MessageStatus, generate_uuid7
│   └── financial.py             Profile, Category, Transaction, MonthlyPlan, Goal
├── schemas/
│   ├── chat.py                  ChatRequest, ChatResponse, ToolCallInfo
│   ├── conversation.py          ConversationCreate/Read, Message, ConversationHistory
│   └── profile.py               ProfileRead, ProfileUpdate (UI onboarding/settings form)
├── repositories/
│   ├── conversations.py         ConversationRepository (all user_id-scoped)
│   ├── messages.py              MessageRepository + MessageCreate dataclass
│   ├── profile_repository.py    ProfileRepository
│   ├── category_repository.py   CategoryRepository (shared reference data)
│   ├── transaction_repository.py TransactionRepository (ledger + analytical aggregates)
│   ├── goal_repository.py       GoalRepository
│   └── monthly_plan_repository.py MonthlyPlanRepository
├── routers/
│   ├── health.py                GET /health
│   ├── chat.py                  POST /api/v1/chat
│   ├── conversations.py         conversation CRUD + message history endpoints
│   └── profile.py               GET/POST /api/v1/profile (UI form, not AI)
├── services/
│   ├── agent_service.py         LangChain agent, SYSTEM_PROMPT, extract_agent_output, ToolExchange
│   ├── chat_service.py          ChatService.send_message (the chat orchestration)
│   ├── conversation_service.py  ConversationService (turn persistence, history, idempotent replay)
│   ├── profile_service.py       ProfileService (read for AI; create/update for UI form)
│   ├── dashboard_service.py     DashboardService (aggregates plan + ledger + goals + profile)
│   ├── transaction_service.py   TransactionService (list, add, spending breakdown, income summary)
│   ├── goal_service.py          GoalService (list, add, update progress)
│   ├── monthly_plan_service.py  MonthlyPlanService (set plan, budget status)
│   └── category_service.py      CategoryService (list categories)
├── tools/                       database-backed tools; all_tools registry
│   ├── profile.py               get_profile
│   ├── dashboard.py             get_dashboard
│   ├── spending.py              get_spending_breakdown, get_income_summary
│   ├── transactions.py          get_recent_transactions, add_transaction
│   ├── goals.py                 get_financial_goals, add_goal, update_goal_progress
│   ├── plans.py                 get_budget_status, set_monthly_plan
│   ├── categories.py            get_categories
│   └── calculator.py            calculator (pure, no DB)
└── utils/
    ├── langchain_messages.py    db_messages_to_langchain (DB rows → LangChain messages)
    └── financial.py             month ranges, period resolution, money formatting
```

Data flows one way: `Routes → Services → Repositories → SQLAlchemy → Postgres`.

---

## Rate Limiting (`core/rate_limit.py`)

Rate limiting is applied at the route layer via `slowapi` with an in-memory backend (swappable to Redis). Every protected or public API endpoint carries a `@limiter.limit(...)` decorator; intentionally unrestricted probes such as `/health/live` do not.

**Key function** (`_get_rate_limit_key`): uses a SHA-256 hash of `X-User-ID` when supplied, then a SHA-256 hash of the bearer token, and finally `get_remote_address` (IP). These values are throttling keys only; authorization still comes exclusively from the verified JWT.

Because headers are enabled, every limited endpoint explicitly accepts both `request: Request` and `response: Response`. The route decorator stays above `@limiter.limit(...)` so FastAPI registers SlowAPI's wrapped endpoint.

**Tiered limits** (configured via env, defaults):
| Tier | Limit | Applies to |
|---|---|---|
| Chat | `20/minute` | `POST /api/v1/chat` |
| Financial | `60/minute` | `/dashboard`, `/goals`, `/transactions` |
| Conversations | `60/minute` | `/conversations/*` (CRUD + messages) |
| Profile | `30/minute` | `/profile` (GET + POST) |
| Health | `60/minute` | `/health` (IP-based) |
| Dev | `10/minute` | `/api/v1/dev/token` |

`/health/live` is intentionally exempt for process/orchestrator liveness checks.

**429 response** includes `Retry-After` header and `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers (exposed via CORS). Disable globally with `RATE_LIMIT_ENABLED=false`.

---

## Request lifecycle (`POST /api/v1/chat`)

```
ChatRequest {message, user_id, conversation_id?, idempotency_key?}
      │
      ▼
ChatService.send_message                     services/chat_service.py
      │
      1. Idempotency: if idempotency_key present, ConversationService.get_idempotent_result()
         returns a prior ChatResponse (replay, no agent, no new rows).
      2. Resolve conversation:
           - no conversation_id → ConversationService.create_conversation(user_id)
           - else ConversationRepository.get(conversation_id, user_id) → None means 404
3. ConversationService.save_user_message(...)  → role=user, status=completed
       4. ContextManager.build_context(user_id, conversation_id)  → FinancialContext → SystemMessage
       5. ConversationService.get_recent_messages(conversation_id, user_id, MAX_CONVERSATION_HISTORY)
          → DB rows → db_messages_to_langchain → list[BaseMessage]
       6. all_messages = context_messages + recent
       7. agent_service.invoke_agent(all_messages)  → agent injects SYSTEM_PROMPT internally
       8. extract_agent_output(result, input_count=len(all_messages))
          → (final AIMessage, list[ToolExchange], list[ToolCallInfo])
       9. ConversationService.save_assistant_turn(...)  → one atomic commit
      10. On any exception: save_assistant_turn(error=...) → one status='failed' assistant row
      │
      ▼
ChatResponse {response, conversation_id, tool_calls[]}
```

### Why `input_count` slicing

`result["messages"]` from `create_react_agent` is the *full* state: the history we passed in **plus** this turn's generated messages. Everything after index `input_count` is what this invocation produced, so only that tail gets persisted. `input_count` is `len(all_messages)` — the context SystemMessage counts as input and is excluded from persistence.

---

## Agent layer (`services/agent_service.py`)

- `SYSTEM_PROMPT` — generated fresh in code. Never stored as a DB row (a prompt fix must apply to every conversation immediately).
- `_get_agent()` — lazily builds a `create_react_agent(model, tools=all_tools, prompt=SYSTEM_PROMPT)`. Module-level singleton; reuse is expected.
- `invoke_agent(messages)` — `agent.ainvoke({"messages": list(messages)})`.
- `extract_agent_output(result, input_count)` — parses the turn's tail:
  - `AIMessage` with `tool_calls` → start/continue a `ToolExchange`.
  - `ToolMessage` → appended to the current exchange's `tool_messages`.
  - `AIMessage` without `tool_calls` → the **final** assistant message (carries `usage_metadata` for tokens).
  - Builds the response `tool_calls` list from the exchanges.

## Context Manager (`ai_service/context/`)

The Context Manager assembles a lightweight base context (profile + current UTC date)
before every agent invocation. It sits between ChatService and the agent — never
inside the agent loop.

- **`ContextManager.build_context(user_id, conversation_id)`** — runs all registered loaders,
  returns a frozen `FinancialContext`.
- **`FinancialContext.to_langchain_messages()`** — renders context as `[SystemMessage]` to prepend
  to conversation history.
- **`ContextLoader` ABC** — single-method contract: `async def load(user_id, session) -> ContextModule`.
  Each loader resolves its own service dependencies; the manager imports no financial code.

The static `SYSTEM_PROMPT` in `create_react_agent` is unaffected. Base context arrives as a
separate `SystemMessage` in the messages list, keeping agent instructions and user data
in distinct layers.

See `docs/CONTEXT_MANAGER.md` for the full design and extension guide.

## Tool execution context

Tools are async `@tool` functions that must know *which user* and *which DB session*
to operate on. They never receive these as arguments (that would let the LLM
invent them). Instead `ChatService.send_message` wraps the agent invocation in
`request_context(user_id, session)` (`core/context.py`):

```python
with request_context(user_id, self.session):
    result = await invoke_agent(all_messages)
```

Each tool then calls `get_current_user_id()` / `get_db_session()` to obtain the
authenticated identity and the live session, constructs the service it needs,
and delegates. Tools return **structured JSON only** — no advice, no SQL, no
repository access. Business logic lives in the service layer, matching the
router→service→repository rule.

### `ToolExchange`

```python
@dataclass
class ToolExchange:
    ai_message: AIMessage          # assistant turn that emitted tool_calls
    tool_messages: list[ToolMessage]  # results, in order
```

---

## Message conversion (`utils/langchain_messages.py`)

Single function, used everywhere a message list is built:

| DB row | LangChain object |
|---|---|
| `role='user'` | `HumanMessage(content)` |
| `role='system'` | **skipped** — system is generated fresh, never loaded |
| `role='assistant'`, no `tool_calls` | `AIMessage(content)` |
| `role='assistant'`, with `tool_calls` | `AIMessage(content, tool_calls=[{name, args, id}...])` rebuilt from JSONB |
| `role='tool'` | `ToolMessage(content, tool_call_id=...)` |

**Pairing assertion:** a `role='tool'` row must immediately follow the assistant row whose `tool_calls` contains its `tool_call_id`. `db_messages_to_langchain` raises otherwise — the model API would reject the request, so we fail fast before calling out.

---

## Persistence of a turn (`services/conversation_service.py`)

`save_assistant_turn(conversation_id, user_id, ai_message, tool_exchanges, error=None)`:

- **Success path**, in order, one commit:
  1. For each `ToolExchange`: an assistant row (`content`, `tool_calls` JSONB mirroring `{name, args, id}`), then one `role='tool'` row per `ToolMessage` (`content` = stringified output, `tool_call_id`).
  2. The final assistant text row (`status='completed'`), with `prompt/completion/total_tokens` from `ai_message.usage_metadata`.
- **Error path**: a single `status='failed'` assistant row with the error in `metadata`.
- `ConversationRepository.touch(conversation_id, increment=len(saved))` bumps `message_count` and `last_message_at`.

Atomicity guarantees a reload never sees an orphaned `tool` row or a half-saved turn.

---

## Repository contracts

### `ConversationRepository` — ALL scoped by `user_id`
- `create(user_id, title=None) -> Conversation`
- `get(conversation_id, user_id) -> Conversation | None` — access-control point
- `list_for_user(user_id, cursor=None, limit=50) -> list[Conversation]`
- `soft_delete(conversation_id, user_id) -> bool`
- `touch(conversation_id, increment=1) -> None`

### `MessageRepository`
- `create(message: MessageCreate) -> Message` — idempotency via the partial unique index + SAVEPOINT catch, never check-then-insert
- `get_by_idempotency_key(user_id, idempotency_key) -> Message | None`
- `load_recent(conversation_id, user_id, limit) -> list[Message]` — most recent N, chronological order
- `load_all(conversation_id, user_id, cursor=None, limit=100) -> list[Message]` — chronological page, UI only
- `update_status(message_id, status, metadata=None) -> None`

`MessageCreate` is an internal dataclass (not an API schema) carrying all insertable fields.

---

## Idempotent replay

`ConversationService.get_idempotent_result(user_id, idempotency_key)`:

1. Find the user message with that key.
2. Load all messages for its conversation, slice the rows *after* that user message up to the next user message (that send's turn only).
3. Return `ChatResponse` built from the turn's final assistant row + its `tool_calls`/`tool` rows.

Replays are scoped to the owning user. `load_recent` is **not** used here because it caps at N — the turn could have been pushed out of the recent window by later activity.
