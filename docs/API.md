# API Reference

All endpoints are served by the FastAPI app in `ai_service/main.py`. Read this before changing any endpoint or request/response schema. Interactive docs: `http://localhost:8000/docs`.

---

## Authentication

Authentication is handled entirely by **Supabase Auth** on the frontend (the
client uses `@supabase/supabase-js` to sign up / sign in). This backend performs
**no** user creation, password storage, or token issuance. It only **verifies**
the Supabase-issued access token (JWT) sent by the client and derives the
authenticated user from it.

### Authorization header

Every protected endpoint requires:

```
Authorization: Bearer <supabase_access_token>
```

The token is verified by `ai_service/auth/`:

- **Signature**: validated against the project's JWKS (asymmetric public keys —
  ES256 for this project; RS256 also supported). No HS256 shared secret is ever
  stored on the backend.
- **Issuer** (`iss`): must equal `SUPABASE_URL + "/auth/v1"`.
- **Audience** (`aud`): must equal `authenticated`.
- **Expiration** (`exp`): enforced automatically.

The verified `sub` claim becomes `CurrentUser.id` — this is the **only**
`user_id` the application trusts. Request bodies, path params, and query
params **never** carry `user_id`. Adding a `user_id` field to a request is a
regression.

### Errors — `401 Unauthorized`

```json
{ "detail": "Authorization header missing or not a Bearer token." }
```

| cause | detail |
|---|---|
| Missing / non-Bearer header | `Authorization header missing or not a Bearer token.` |
| Invalid signature / claims / malformed | `Invalid authentication token.` |
| Expired | `Authentication token has expired.` |

All 401 responses include `WWW-Authenticate: Bearer`.

### Dev helper — `POST /api/v1/dev/token` (development only)

Registered **only** when `ENVIRONMENT=development` (returns 404 otherwise).
Relays email/password to Supabase Auth's password grant and returns the issued
JWT so it can be pasted into Swagger's **Authorize** button. It performs no
authentication of its own.

```json
// request
{ "email": "user@buywise.dev", "password": "..." }
// response
{ "access_token": "eyJ...", "token_type": "bearer", "expires_in": 3600,
  "user_id": "00000000-0000-0000-0000-000000000001", "email": "user@buywise.dev" }
```

---

## Conventions

- JSON request/response bodies.
- Error format (FastAPI default): `{"detail": "..."}`.
- The authenticated `user_id` comes from the verified JWT (`CurrentUser.id`),
  injected via `Depends(get_current_user)`. It is never read from the body/path/query.
- All conversation reads/writes are scoped by that `user_id` at the repository
  layer — the security boundary (see AGENTS.md).
- **Rate limiting:** protected and public API endpoints are rate-limited using a
  hashed `X-User-ID`, hashed bearer token, or IP fallback. Exceeding the limit returns
  `429 Too Many Requests` with
  `Retry-After` and `X-RateLimit-*` headers. See `docs/ARCHITECTURE.md#rate-limiting`
  for tier details. `/health/live` is intentionally exempt for liveness checks.

---

## `POST /api/v1/chat`

Send a message to the AI assistant and get a response. Creates a new conversation automatically if no `conversation_id` is given. **Requires authentication.**

### Request headers

```
Authorization: Bearer <supabase_access_token>
```

### Request body

```json
{
  "message": "What is my current balance?",
  "conversation_id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d",
  "idempotency_key": "3f7a...optional-client-generated-uuid"
}
```

| field | type | required | description |
|---|---|---|---|
| `message` | string | yes | user's message |
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
| `401` | missing/invalid/expired JWT |
| `404` | `conversation_id` not found for that user (or belongs to another user) |
| `422` | schema validation failure (e.g. empty `message`) |
| `429` | rate limit exceeded (20 req/min per user) |

On an agent failure the endpoint still returns `200` with an apology message and the assistant turn is persisted as `status='failed'`; retry with a **fresh** `idempotency_key` for a new attempt.

---

## `POST /api/v1/conversations`

Create a conversation explicitly. **Requires authentication.**

### Request body

```json
{ "title": "My budget" }
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

`user_id` is taken from the JWT, not the body.

---

## `GET /api/v1/conversations`

List the authenticated user's conversations, most recently active first. **Requires authentication.** (Replaces the old `GET /api/v1/users/{user_id}/conversations`.)

### Query params

| param | type | required | description |
|---|---|---|---|
| `cursor` | datetime | no | `updated_at` keyset cursor for pagination |
| `limit` | int (1–200) | no | page size, default 50 |

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

Full message history for UI display. **Requires authentication.** **Never fed to the agent** — the agent only ever receives `ChatService`'s capped recent context.

### Query params

| param | type | required | description |
|---|---|---|---|
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
| `401` | missing/invalid/expired JWT |
| `404` | conversation not found for the authenticated user (incl. other users / soft-deleted) |

---

## `DELETE /api/v1/conversations/{conversation_id}`

Soft-delete a conversation (sets `deleted_at`). Messages are hidden from reads but rows remain. **Requires authentication.**

### Response — `200 OK`

```json
{ "status": "deleted", "conversation_id": "019fbf89-af86-74a0-9c0b-4dc051ae0f8d" }
```

### Errors
| status | when |
|---|---|
| `401` | missing/invalid/expired JWT |
| `404` | conversation not found for the authenticated user |

---

## `GET /api/v1/profile`

Return the authenticated user's financial profile (used by the onboarding/settings UI). **Requires authentication.**

### Response — `200 OK`

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "full_name": "Rahul Sharma",
  "currency": "INR",
  "income_type": "salaried",
  "salary_day": 28,
  "timezone": "Asia/Kolkata",
  "onboarding_complete": true,
  "savings_target_percent": 20,
  "investment_style": "moderate",
  "budget_alerts": true,
  "created_at": "2026-08-05T00:00:00Z",
  "updated_at": "2026-08-05T00:00:00Z"
}
```

`id` is derived from the verified JWT, never the request. `income_type` is one of `salaried | freelancer | business_owner | retired | other`; `investment_style` is `conservative | moderate | aggressive`.

### Errors
| status | when |
|---|---|
| `401` | missing/invalid/expired JWT |
| `404` | user has no profile yet (before onboarding) |

---

## `POST /api/v1/profile`

Create or update the authenticated user's profile. Called by the onboarding form (first sign-in) and the settings page. **Requires authentication.** This endpoint is **not** called by the AI — profile data is collected via the UI, the AI only reads it via the `get_profile` tool.

### Request body (all optional — partial updates)

```json
{
  "full_name": "Rahul Sharma",
  "currency": "INR",
  "income_type": "salaried",
  "salary_day": 28,
  "savings_target_percent": 20,
  "investment_style": "moderate",
  "budget_alerts": true,
  "onboarding_complete": true
}
```

| field | type | notes |
|---|---|---|
| `full_name` | string | |
| `currency` | string | default `INR` |
| `income_type` | enum | `salaried` / `freelancer` / `business_owner` / `retired` / `other` |
| `salary_day` | int (1–31) | nullable — many users are freelancers/business owners |
| `savings_target_percent` | int (0–100) | |
| `investment_style` | enum | `conservative` / `moderate` / `aggressive` |
| `budget_alerts` | bool | default `true` |
| `onboarding_complete` | bool | set `true` when the form submits the full set |

If no profile row exists yet, one is created with `id = auth.uid()`.

### Response — `200 OK` (`ProfileRead`, same shape as GET)

### Errors
| status | when |
|---|---|
| `401` | missing/invalid/expired JWT |
| `422` | no fields provided / invalid enum or range |

---

## `GET /health`

Public (no authentication).

```json
{ "status": "ok", "service": "buywise-ai" }
```

## `GET /health/live`

Public and intentionally exempt from rate limiting. Use this only for process
orchestrator liveness checks.

```json
{ "status": "ok", "service": "buywise-ai" }
```

---

## Example workflow (curl)

```bash
# 0. (Development only) Obtain a Supabase JWT via the dev helper.
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/dev/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@buywise.dev","password":"your-password"}' | jq -r .access_token)

# 1. First message (new conversation auto-created)
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is my balance?"}'

# 2. Follow-up in the same conversation (use the returned conversation_id)
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Any Swiggy transactions?","conversation_id":"<id from step 1>"}'

# 3. Idempotent retry (safe to re-send; replays the prior result)
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is my balance?","idempotency_key":"fixed-key-for-this-send"}'

# 4. Read history (no user_id query param — derived from the JWT)
curl -s "http://localhost:8000/api/v1/conversations/<id>/messages" \
  -H "Authorization: Bearer $TOKEN"
```
