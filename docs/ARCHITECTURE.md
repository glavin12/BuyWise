# Architecture

Deep-dive for anyone (human or agent) modifying the agent, chat flow, or message conversion. Start with `AGENTS.md` for the non-negotiable rules.

---

## Module map

```
ai_service/
├── main.py                      FastAPI app, router registration, lifespan
├── core/config.py               Pydantic Settings (env-driven)
├── db/
│   ├── base.py                  DeclarativeBase
│   └── session.py               async engine / session factory / get_async_session
├── models/
│   └── conversation.py          Conversation, Message, MessageRole, MessageStatus, generate_uuid7
├── schemas/
│   ├── chat.py                  ChatRequest, ChatResponse, ToolCallInfo
│   └── conversation.py          ConversationCreate/Read, Message, ConversationHistory
├── repositories/
│   ├── conversations.py         ConversationRepository (all user_id-scoped)
│   └── messages.py              MessageRepository + MessageCreate dataclass
├── routers/
│   ├── health.py                GET /health
│   ├── chat.py                  POST /api/v1/chat
│   └── conversations.py         conversation CRUD + message history endpoints
├── services/
│   ├── agent_service.py         LangChain agent, SYSTEM_PROMPT, extract_agent_output, ToolExchange
│   ├── chat_service.py          ChatService.send_message (the chat orchestration)
│   └── conversation_service.py  ConversationService (turn persistence, history, idempotent replay)
├── tools/                       mock financial tools; all_tools registry
└── utils/
    └── langchain_messages.py    db_messages_to_langchain (DB rows → LangChain messages)
```

Data flows one way: `Routes → Services → Repositories → SQLAlchemy → Postgres`.

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
      4. ConversationService.get_recent_messages(conversation_id, user_id, MAX_CONVERSATION_HISTORY)
         → DB rows → db_messages_to_langchain → list[BaseMessage]
      5. agent_service.invoke_agent(recent)  → agent injects SYSTEM_PROMPT internally
      6. extract_agent_output(result, input_count=len(recent))
         → (final AIMessage, list[ToolExchange], list[ToolCallInfo])
      7. ConversationService.save_assistant_turn(...)  → one atomic commit
      8. On any exception: save_assistant_turn(error=...) → one status='failed' assistant row
      │
      ▼
ChatResponse {response, conversation_id, tool_calls[]}
```

### Why `input_count` slicing

`result["messages"]` from `create_react_agent` is the *full* state: the history we passed in **plus** this turn's generated messages. Everything after index `input_count` is what this invocation produced, so only that tail gets persisted.

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
