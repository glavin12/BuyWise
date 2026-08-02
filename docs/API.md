# API Reference

All endpoints are served by the FastAPI app in `ai_service/main.py`. Read this before changing any endpoint or request/response schema. Interactive docs: `http://localhost:8000/docs`.

---

## Conventions

- JSON request/response bodies.
- Error format (FastAPI default): `{"detail": "..."}`.
- Every conversation-scoped read/write takes `user_id` (path or query) — access control is enforced server-side against that `user_id`; there is no session/token mechanism yet.

---

## `POST /api/v1/chat`

Send a message to the AI assistant and get a response. Creates a new conversation automatically if no `conversation_id` is given.

### Request

```json
{
  "message": "What is my current balance?",
  "user_id": "00000000-0000-0000-0000-000000000001",
  "conversation_id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d",
  "idempotency_key": "3f7a...optional-client-generated-uuid"
}
```

| field | type | required | description |
|---|---|---|---|
| `message` | string | yes | user's message |
| `user_id` | uuid | yes | the authenticated user's ID |
| `conversation_id` | uuid | no | existing conversation; auto-created if omitted |
| `idempotency_key` | string | no | exactly-once: a prior completed send with the same key is replayed |

### Response — `200 OK`

```json
{
  "response": "Your current balance is ₹47,250.00.",
  "conversation_id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d",
  "tool_calls": [
    {
      "tool_name": "get_dashboard",
      "tool_input": {},
      "tool_output": "{...json string...}"
    }
  ]
}
```

### Idempotency semantics

- Same `conversation_id` + same `idempotency_key` → the prior `ChatResponse` is returned as-is. **No new user message, no agent call, no new rows.**
- Omit `idempotency_key` and the server generates one internally for the user message, so network retries are still deduplicated.
- A replay is scoped to the owning user and to that send's turn only.

### Errors
| status | when |
|---|---|
| `400` | `user_id` missing/invalid |
| `404` | `conversation_id` not found for that user (or belongs to another user) |
| `422` | schema validation failure (e.g. empty `message`) |

On an agent failure the endpoint still returns `200` with an apology message and the assistant turn is persisted as `status='failed'`; retry with a **fresh** `idempotency_key` for a new attempt.

---

## `POST /api/v1/conversations`

Create a conversation explicitly.

### Request

```json
{ "user_id": "00000000-0000-0000-0000-000000000001", "title": "My budget" }
```

### Response — `200 OK` (`ConversationRead`)

```json
{
  "id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d",
  "user_id": "00000000-0000-0000-0000-000000000001",
  "title": "My budget",
  "message_count": 0,
  "last_message_at": null,
  "created_at": "2026-08-02T00:00:00Z",
  "updated_at": "2026-08-02T00:00:00Z"
}
```

---

## `GET /api/v1/users/{user_id}/conversations`

List a user's conversations, most recently active first.

### Response — `200 OK`

```json
[
  {
    "id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d",
    "user_id": "00000000-0000-0000-0000-000000000001",
    "title": null,
    "message_count": 8,
    "last_message_at": "2026-08-02T00:00:01Z",
    "created_at": "2026-08-02T00:00:00Z",
    "updated_at": "2026-08-02T00:00:01Z"
  }
]
```

Soft-deleted conversations are excluded.

---

## `GET /api/v1/conversations/{conversation_id}/messages`

Full message history for UI display. **Never fed to the agent** — the agent only ever receives `ChatService`'s capped recent context.

### Query params

| param | type | required | description |
|---|---|---|---|
| `user_id` | uuid | yes | access control |
| `cursor` | datetime | no | created_at keyset cursor for pagination |
| `limit` | int (1–500) | no | page size, default 100 |

### Response — `200 OK`

```json
{
  "conversation_id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d",
  "messages": [
    {
      "id": "...",
      "role": "user",
      "content": "What is my current balance?",
      "tool_call_id": null,
      "status": "completed",
      "created_at": "2026-08-02T00:00:00Z"
    },
    {
      "id": "...",
      "role": "assistant",
      "content": "",
      "tool_call_id": null,
      "status": "completed",
      "created_at": "2026-08-02T00:00:00.001Z"
    },
    {
      "id": "...",
      "role": "tool",
      "content": "{...stringified tool output...}",
      "tool_call_id": "call_abc123",
      "status": "completed",
      "created_at": "2026-08-02T00:00:00.002Z"
    }
  ]
}
```

`role` is `user | assistant | system | tool`; `status` is `pending | completed | failed`.

### Errors
| status | when |
|---|---|
| `404` | conversation not found for `user_id` (incl. other users / soft-deleted) |

---

## `DELETE /api/v1/conversations/{conversation_id}`

Soft-delete a conversation (sets `deleted_at`). Messages are hidden from reads but rows remain.

### Query params

| param | type | required |
|---|---|---|
| `user_id` | uuid | yes |

### Response — `200 OK`

```json
{ "status": "deleted", "conversation_id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d" }
```

### Errors
| status | when |
|---|---|
| `404` | conversation not found for `user_id` |

---

## `GET /health`

```json
{ "status": "ok", "service": "buywise-ai" }
```

---

## Example workflow (curl)

```bash
# 1. First message (new conversation auto-created)
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is my balance?","user_id":"00000000-0000-0000-0000-000000000001"}'

# 2. Follow-up in the same conversation (use the returned conversation_id)
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Any Swiggy transactions?","user_id":"00000000-0000-0000-0000-000000000001","conversation_id":"<id from step 1>"}'

# 3. Idempotent retry (safe to re-send; replays the prior result)
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is my balance?","user_id":"00000000-0000-0000-0000-000000000001","idempotency_key":"fixed-key-for-this-send"}'

# 4. Read history
curl -s "http://localhost:8000/api/v1/conversations/<id>/messages?user_id=00000000-0000-0000-0000-000000000001"
```
