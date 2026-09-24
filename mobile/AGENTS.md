# BuyWise Mobile

Expo / React Native client for the BuyWise backend (FastAPI + Supabase, in the repo root: see [`../AGENTS.md`](../AGENTS.md)). This file describes the app as it is in the code today and is the operating reference for coding agents. Prioritize mobile-first patterns, performance, and cross-platform compatibility. The rulebook every change follows is [`../BUYWISE_MOBILE_GUIDE.md`](../BUYWISE_MOBILE_GUIDE.md); its "Suggested Structure" is aspirational, the real layout is under [Layout](#layout).

## Keeping this file current

- The code is the source of truth. When this file and the code disagree, change this file (never the code), in the same change as the feature or fix.
- `AGENTS.md` and `CLAUDE.md` in this folder are identical, because different coding agents read different ones. Edit both together; `diff AGENTS.md CLAUDE.md` must print nothing.
- Write only what you verified in the code. If the code cannot answer something (plans, intent, scope), ask the owner instead of guessing.
- After a feature adds, removes or changes a screen, an API call, a dependency or a convention, update [Status](#status) and any section it touches.

## Status

Verified against the code on 2026-09-24. Phase names come from the README and code comments. No written plan for phases 1.5, 4 and 5 exists in the repo, so ask the owner before inventing their scope.

| Phase | Scope | State |
|---|---|---|
| 1 | Auth, session persistence, API client, 5-tab shell, Dashboard | Done |
| 1.5 | Real visual design; `src/ui/theme.ts` is a "greybox" placeholder it replaces | Not built |
| 2 | Transactions: list, quick add, detail, edit, delete | Done |
| 3 | Budget (per month) and Goals | Done |
| 4 | AI chat | Done: new chat on the Chat tab, History, open and delete a conversation |
| 5 | Reports and full Settings | Not built: placeholders |

### Screens (`src/app/`)

| Route files | What it does | State |
|---|---|---|
| `(auth)/login`, `(auth)/signup` | Log in; sign up (shows "Check your email" when Supabase wants the email confirmed) | Done. No forgot-password |
| `(tabs)/index` | Dashboard: balance, income / spent / net, budget line, 3 recent transactions, this / last month | Done |
| `(tabs)/transactions` | Day-grouped list, infinite scroll (20 per page), type and date-range filters, client-side search over the rows already loaded | Done |
| `add-transaction`, `(tabs)/add` | Quick-add modal opened by the centre tab button ("Save & add another", category suggested from the payee); `add` only redirects to it | Done |
| `transaction/[id]`, `transaction/[id]/edit` | Detail, edit (optimistic update with rollback), delete | Done |
| `(tabs)/budget`, `budget/set` | Month switcher, "ready to assign", per-category progress, set / edit / delete, copy from last month | Done |
| `goals/index`, `goals/new`, `goals/[id]`, `goals/[id]/contribute`, `goals/[id]/edit` | Active / achieved lists, create, contribute (celebration when reached), edit, archive | Done |
| `settings` | Email, name, Sign out | Partial |
| `(tabs)/chat` | A new chat (header: History, New chat). Markdown replies, tool cards and "Thinking" on the reply that just arrived, 4 suggestions, retry a failed send, long-press copies text | Done |
| `conversations/index`, `conversations/[id]` | History grouped Today / This week / Older (long-press deletes); an existing thread, which continues in place | Done |
| `reports` | "Coming in Phase 5" | Placeholder |

### Backend calls

`src/lib/api.ts` wraps 34 calls; screens use 23 of them, always through `queries.ts` / `mutations.ts`. Written but not used by any screen yet: `updateProfile`, `getCategory`, `updateCategory`, `deleteCategory`, `getPayee`, `updatePayee`, `deletePayee`, `getBudget`, `categoryAnalytics`, `paymentMethodAnalytics`, `comparisonAnalytics`.

### Not set up

No `eas.json`. No `android.package` or `ios.bundleIdentifier` in `app.json`. Light theme only (`userInterfaceStyle: "light"`). No push notifications. No offline write queue (offline disables write buttons). No screen or component tests (`npm test` covers `src/lib` only).

### Baseline

2026-09-25: `npm test` 80 passing; `npx tsc --noEmit` and `npx expo lint` clean.

## Stack

Expo SDK 57 (`expo ~57.0.24`), React Native 0.86.3, React 19.2.3 with the React Compiler on, Expo Router with typed routes, TypeScript `strict`, TanStack Query 5 for server state, `@supabase/supabase-js` for authentication only, `expo-secure-store` for the session, NetInfo for connectivity, Ionicons for icons, `@ronradtke/react-native-markdown-display` (pure JS, runs in Expo Go) for chat replies, imported only by `src/ui/Markdown.tsx`. See `package.json` for the rest. The package manager is npm (`package-lock.json`).

## Commands

```bash
npm install
npx expo start              # dev server (Expo Go, or press w for web)
npm test                    # node --test src/lib/*.test.ts (Node's built-in runner, no Jest)
npx tsc --noEmit            # typecheck
npx expo lint               # lint
npx expo-doctor             # diagnose dependency and config issues
npx expo install <package>  # ALWAYS use this to add a package: resolves SDK-compatible versions
npx expo install --fix      # fix incompatible package versions
```

Run tests, typecheck and lint before declaring any task done. New logic in `src/lib` gets a `*.test.ts` beside it. A feature is done when its loading, empty, error, validation, offline, keyboard and Android-back behavior work too (full list: the guide).

## Layout

- `src/app/`: Expo Router routes. Every file is a screen and `_layout.tsx` files define navigators; keep non-route code out of it. The signed-in / signed-out route guard (`Stack.Protected`) is in `src/app/_layout.tsx`.
- `src/ui/`: primitives (`Screen`, `Button`, `Card`, `Text`, `Input`, `Amount`, `TransactionEditor`, ...). It is the only code that reads `theme.ts`; screens import from `@/ui`, which does not export the theme.
- `src/lib/`: everything that is not UI. `api.ts` (typed client), `queries.ts` and `mutations.ts` (the only way screens read and write server data, including cache keys and invalidation), `errors.ts`, `types.ts`, `network.ts`, `queryClient.ts`, `supabase.ts`, `format.ts`, `labels.ts`, and pure logic with a `*.test.ts` beside it: `money`, `dates`, `ledger`, `transactionForm`, `budget`, `goals`, `errors`, `ids`, `chat`.
- `src/providers/AuthProvider.tsx`: session, `signIn` / `signUp` / `signOut`, the "session expired" notice.
- Alias `@/*` maps to `src/*`.

## Rules

1. **Data goes through `queries.ts` / `mutations.ts`.** Screens never call `api` directly. `invalidateAfter()` in `queries.ts` is the only place that knows which caches a write makes stale; a new kind of write adds a `Change` case there.
2. **Errors:** never render `err.message`; use `userMessage(err, "save this expense")`. A 404 on delete or update means "already gone" (`isNotFound`). A batch stops on `stopsBatch` errors (offline, signed out, rate limited).
3. **Money is integer minor units (paise).** Parse typed text only with `src/lib/money.ts`, total with `sumMinor`, never add `display_*` floats, and show amounts with `Amount` / `formatCurrency` / `formatMinor`. Amount fields use `AmountInput`.
4. **Dates are local calendar `YYYY-MM-DD`** computed on the phone (`todayLocal`, `rangeFor`, `monthShift`). List queries send explicit `date_from` / `date_to` because the server's own "this month" follows its UTC clock. The Dashboard is the exception: it sends `period=this_month|last_month`.
5. **Visuals live in `src/ui`.** A new look becomes a primitive there, not inline styles in a screen.
6. **Pure logic in `src/lib`** is import-free or imports siblings with an explicit `.ts` extension, so `node --test` runs it without a bundler. A module that imports `@/...`, React or React Native cannot be tested that way.
7. **Every data screen handles Loading (`Skeleton`), Success, Empty (`EmptyState`) and Error (`ErrorState` with retry).** If cached data exists and a refresh fails, keep showing it with `Banner tone="warning"` ("Couldn't refresh. Showing ..."). Tab roots support pull-to-refresh and `useRefetchStaleOnFocus()`.
8. **Forms and writes:** guard unsaved input with `useDiscardGuard`; destructive actions go through `confirm()`; success is `hapticSuccess()` plus `showToast()`. Writing buttons use `requiresNetwork` and are disabled while pending; the API has no idempotency for transactions, so that guard is what stops a double tap.
9. **Routes that take an id from the URL** validate it with `isUuid()` and show `NotFoundScreen` otherwise.
10. **Auth:** the session is kept in SecureStore (split into chunks because values can exceed ~2 KB; web falls back to localStorage). On a 401 the client refreshes the token once (single-flight), retries once, then signs out locally; `SIGNED_OUT` clears the whole query cache. Supabase is used for authentication only: all data goes through the FastAPI API with `Authorization: Bearer <access token>`, and the `anon` / `authenticated` database roles have no table privileges, so never query Supabase tables directly.
11. **Network:** `networkMode: "always"`. `useOnline()` means only "no connection at all" and drives the offline banner and `requiresNetwork` buttons. Default `staleTime` 30 s, one retry except on 4xx, no refetch on reconnect (it only marks data stale). Timeouts: 15 s for CRUD, 60 s for chat.
12. **Comments:** short tags (`C4`, `L3`, `A1`, ...) mark edge cases handled on purpose, so keep them intact when editing nearby code. A `ponytail:` comment marks a deliberate shortcut and names its ceiling and upgrade path; read it before changing that code.

## Backend contract the client relies on

The API lives in `../ai_service/` (details in `../AGENTS.md`). `src/lib/types.ts` mirrors its response shapes by hand (no codegen): when a backend schema or route changes, update `types.ts` and `api.ts` in the same change.

- **One balance, no accounts or transfers.** The Dashboard's `current_balance` is income + starting balances - expenses. Each transaction has an optional `payment_method`: `cash`, `upi`, `bank_transfer`, `card` or `other`.
- **Amounts** are integer minor units; every money field also has a `display_*` float for display only.
- **Transaction types** are `expense`, `income` and `starting_balance`. Expense and income need a category of the same type. The add form offers Expense and Income only; a starting balance can be viewed and edited but not created in the app.
- **Categories and payees** are per user and seeded on the first `GET /profile` (36 each). A category's `type` cannot change. `DELETE /categories/{id}` archives it (hidden from lists, still shown on old transactions and budgets). `POST /categories` and `POST /payees` return the existing row when the name already exists, and `payee_name` on a new transaction finds or creates the payee.
- **Budgets:** `POST /budgets` is an upsert per category and month; `GET /budgets/YYYY-MM` returns `spent`, `remaining` and `percent_used`. Only active expense categories can be budgeted.
- **Goals** have no GET-by-id and no DELETE. The app finds a goal in the cached Active / Achieved lists, and archiving (`PATCH status=archived`) is the removal path. The server sets `status` to `completed` when `current_amount >= target_amount`, and back to `active` if it drops below, unless a `status` is sent or the goal is archived. Contributing sends `current_amount = cached + amount` (there is no atomic contribute endpoint), so two devices contributing at the same moment lose one; this is deliberate and marked with `ponytail:` in `goals/[id]/contribute.tsx`.
- **Transactions list:** `limit` 1 to 100 (the app uses 20), `offset`, and filters `transaction_type`, `category_id`, `payee_id`, `cleared_status`, `date_from`, `date_to`, `period`.
- **Limits and failures:** the API rate-limits per access token, or per IP when there is none (defaults in `ai_service/core/config.py`: 60 per minute for financial routes, 30 for profile, 20 for chat), and a 429 carries `Retry-After`. A 409 is a conflict (duplicate or racing insert); a 401 carries `WWW-Authenticate: Bearer`.
- **Chat:** `api.chat` (60 s timeout), `listConversations` (History shows the 50 newest), `getMessages` and `deleteConversation`; `MSG.busy` is the 409 "Still processing". A message is at most 4000 characters and an agent turn can take up to 60 s. Each new send gets a fresh `idempotency_key` (`newIdempotencyKey`), and a retry of a failed send reuses its key: the server replays a finished send, answers 409 while it is still running and reruns a failed one. `getMessages` returns the newest page in chronological order; the app asks for 500 rows and has no "Load earlier" (`ponytail:` in `queries.ts`). History rows carry no tool calls and reasoning is not stored, so tool cards and "Thinking" show only on the reply that just arrived. `useSendMessage` writes both messages into the thread's cache in the hook options (so they land even if the user left the screen), then invalidates `conversation` plus whatever the reply's tools changed (`changesFromTools`: transactions, payees, budgets, goals). History won't delete a conversation whose reply is still on its way.

## Environment and running

1. Copy `.env.example` to `.env.local` (gitignored via `.env*.local`) and fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the anon / publishable key only, never a `service_role` key) and `EXPO_PUBLIC_API_URL`. The app throws at startup if any is missing. Never commit real values or paste them into docs.
2. `EXPO_PUBLIC_API_URL` must be the PC's LAN IP (`ipconfig`), not `127.0.0.1`, because a phone cannot reach the PC's loopback. Use `https://` for anything except local development.
3. Start the backend so the phone can reach it, from the repo root: `uv run uvicorn ai_service.main:app --reload --host 0.0.0.0`.
4. The phone and PC must share a network that allows device-to-device traffic (campus Wi-Fi often does not; use a phone hotspot). If Expo advertises the wrong adapter (VPN, VirtualBox), set `REACT_NATIVE_PACKAGER_HOSTNAME` to the LAN IP.
5. Supabase email confirmation must be off (or real SMTP configured), otherwise sign-up shows "Check your email".

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently 57).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Navigation, EAS and native code

- Use **Expo Router** for all navigation. Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`. Docs: https://docs.expo.dev/router/introduction.md
- Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`), run as `npx eas-cli@latest <command>`. Not configured yet (see [Not set up](#not-set-up)). Docs: https://docs.expo.dev/eas/index.md
- `ios/` and `android/` do not exist; they are generated (Continuous Native Generation). Never create or edit them by hand: configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
