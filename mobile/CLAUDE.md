# BuyWise Mobile

Expo / React Native client for the BuyWise backend (FastAPI + Supabase, in the repo root: see [`../AGENTS.md`](../AGENTS.md)). This file describes the app as it is in the code today and is the operating reference for coding agents. Prioritize mobile-first patterns, performance, and cross-platform compatibility. The rulebook every change follows is [`../BUYWISE_MOBILE_GUIDE.md`](../BUYWISE_MOBILE_GUIDE.md); its "Suggested Structure" is aspirational, the real layout is under [Layout](#layout).

## Keeping this file current

- The code is the source of truth. When this file and the code disagree, change this file (never the code), in the same change as the feature or fix.
- `AGENTS.md` and `CLAUDE.md` in this folder are identical, because different coding agents read different ones. Edit both together; `diff AGENTS.md CLAUDE.md` must print nothing.
- Write only what you verified in the code. If the code cannot answer something (plans, intent, scope), ask the owner instead of guessing.
- After a feature adds, removes or changes a screen, an API call, a dependency or a convention, update [Status](#status) and any section it touches.

## Status

Verified against the code on 2026-09-28. Phase names come from the README and code comments; the scope of phases 1.5 and 5 came from the owner's Day-0 plan, which is not in the repo.

| Phase | Scope | State |
|---|---|---|
| 1 | Auth, session persistence, API client, 5-tab shell, Dashboard | Done |
| 1.5 | Visual design: the cream tokens, Instrument Sans / Serif and JetBrains Mono, category colours and emoji (`src/ui/theme.ts`, `src/lib/categoryStyle.ts`) | Done |
| 2 | Transactions: list, quick add, detail, edit, delete | Done |
| 3 | Budget (per month) and Goals | Done |
| 4 | AI chat | Done: new chat on the Chat tab, History, open and delete a conversation |
| 5 | Reports and full Settings | Done |
| v3 design | The charcoal redesign from `design/` (Claude Design handoff; `design/README.md` lists the phases). 0: plan. 1: tokens, fonts, SVG illustrations. 2: component kit. 3: the tab bar. 4+: one screen at a time | Phases 1 to 3 done. Phase 4+: Home (2026-09-27), Activity, Quick Add, Budget and Goals (2026-09-28) rebuilt; every other screen still uses the cream primitives (among them the transaction edit form, Set budget, and the goal new / contribute / edit forms) |

### Screens (`src/app/`)

| Route files | What it does | State |
|---|---|---|
| `(auth)/login`, `(auth)/signup` | Log in; sign up (shows "Check your email" when Supabase wants the email confirmed) | Done. No forgot-password |
| `(tabs)/index` | Home (v3, `design/screens/02-home.png`). Greeting (→ Profile), search (→ Activity), bell ("coming soon" toast); a month pill that flips this / last month (the API has only those two); the balance card (↗ Reports; a sentence with the net, the budget state and the active-goal count, whose chips link to Budget and Goals); Spend Pulse: this or last week's expenses summed per day on the phone (`expensesInRangeQuery`, every page), each day as a % of this month's budget ÷ days in the month (of the week's biggest day when nothing is budgeted), days still to come dashed with no forecast, and the top 3 categories as a legend that filters the bubbles and chart; 3 recent tiles (→ detail) | Done |
| `(tabs)/transactions` | Activity (v3, `design/screens/03-activity.png`). The filters live in the URL (`type`, `category`, `month` as YYYY-MM). A category pill by the title (an `OptionSheet` of every active category, or only the chosen type's; switching to the other type drops it), client-side search over the rows already loaded (the voice glyph is a "coming soon" toast), All / Expenses / Income chips, a month pill (the last 12 months), "N transactions found", day groups (Today / Yesterday / date) with the day's net, infinite scroll (20 per page). A row is payee, "note · method · time" (the time is `created_at`'s, shown only when it was logged on the transaction's own date: `loggedTime`), the category tag and the signed amount (income in mint). The first-run coach mark ("tap to chat · hold to add ₹") shows above the centre tab on this screen until the centre button is first used or the hint is tapped (`TabBar` `coachOn`; the flag is kept in SecureStore, localStorage on web) | Done |
| `add-transaction` | Quick Add (v3, `design/screens/04-quick-add-sheet.png`) in a native sheet (`quickAddSheetOptions`: formSheet, 0.92 detent, radius 34, the design's own handle), opened by holding the centre tab. "ADD EXPENSE / INCOME" and close, the Expense / Income toggle, the 86 amount, category tiles (this month's 4 most used expense categories by transaction count; income keeps the list's order; the chosen one is always in the row) and a dashed "More" tile (the full searchable list, which also creates a category), the payee field (the payee's last category is suggested, and a mint "Swiggy → Food, like last time" chip says so), a note field, method chips UPI / Cash / Card / Bank / Other (starting on the newest transaction's method, UPI with no history; tapping the chosen one clears it), a date chip, "SAVE ₹250" and "Save & add another", then a toast naming the amount and category. Beyond the design, on the owner's call: the note field, "Other" and "More" | Done |
| `transaction/[id]`, `transaction/[id]/edit` | Detail, edit (optimistic update with rollback; the cream `TransactionEditor`), delete | Done |
| `(tabs)/budget`, `budget/set` | Budget (v3, from the owner's list mockup of 2026-09-29, not in `design/`; charcoal). A month pill (a sheet from 3 months ahead to 11 back), the marigold "READY TO ASSIGN" card (income − assigned; "give every rupee a job") with "Copy <last month>" (copy from last month) and an "Auto-assign · soon" chip ("coming soon" toast), income / assigned / spent chips (spent is every expense of the month, `analytics/monthly`), then CATEGORY / ASSIGNED / AVAILABLE and one card of rows: only the categories with a budget, most assigned first (`lib/budget` `byAssigned`). A row is a colour dot and the name, a bar, a line (`budgetRow`: "₹1,240 of ₹1,500 spent", "fully spent", tomato "overspent by ₹1,200"), the amount assigned and the AVAILABLE pill (mint money left, grey ₹0, tomato "−₹1,200"). Available is this month's budget − this month's spending: the API has no carry-over. Tapping a row opens `budget/set` (edit, delete). After the list, "N categories still left to assign" with "Manage your budget →" (a sheet of the unbudgeted categories → `budget/set`), then "Your goals →". `budget/set` is still cream | Done |
| `goals/index`, `goals/new`, `goals/[id]/contribute`, `goals/[id]/edit` | Goals (v3, `design/screens/06-goals.png`, sage, no tab bar). Back, the Active / Achieved toggle, the `Dial` for one goal (the highest priority at first; tapping a tile below puts that goal on the dial), "N days left" and "₹X / month" chips, Contribute and ✎ ("Edit goal" once achieved), the other goals as tiles (glyph by goal type, colours cycle), the marigold + for a new goal. There is no goal detail screen: archiving is on the Edit screen. The forms are still cream (create and edit with an optional expense category, contribute with a celebration when reached) | Done |
| `(tabs)/profile` | The Profile tab (was the `settings` stack screen). Email; Profile, Categories and Payees; a budget-alerts switch (optimistic, rolls back on failure); the web's "coming soon" rows (they show a toast); a dev-only "Design kit" row; Sign out | Done |
| `settings/profile` | Name, currency (INR, USD, EUR, GBP), time zone (a curated list plus the saved one, since Hermes may lack `Intl.supportedValuesOf`), join date | Done |
| `settings/categories`, `settings/category/new`, `settings/category/[id]` | Expense / Income lists; create and edit name, emoji icon and colour (one of the 8 hues); type locked when editing; archive | Done |
| `settings/payees`, `settings/payee/new`, `settings/payee/[id]` | Type filter and search; create, rename (type locked), delete | Done |
| `(tabs)/chat` | A new chat (header: History, New chat). Markdown replies, tool cards with a readable summary and "Thinking" on the reply that just arrived, 4 suggestions (the first one personalised when there are no transactions or no budget), prefill chips above the input that fill it without sending, an AI disclaimer, retry a failed send, long-press copies text | Done |
| `conversations/index`, `conversations/[id]` | History grouped Today / This week / Older with relative times (long-press deletes); an existing thread, which continues in place | Done |
| `kit` | Dev-only (`__DEV__`, redirects home otherwise) gallery of the v3 kit and the 5 illustrations, to compare with `design/screens/*.png` | Done |
| `reports` | Month switcher (not past the current month); 6-month income vs spend bars (the six months load in parallel), savings rate against the 6-month average, spending by category, the month against the one before, spending by payment method, two insight cards. Each section loads and fails on its own | Done |

### Backend calls

`src/lib/api.ts` wraps 34 calls; screens use 33 of them, always through `queries.ts` / `mutations.ts`. Written but not used: `getBudget` (`budget/set` finds the row in the month's list).

### Not set up

No `eas.json`. No `android.package` or `ios.bundleIdentifier` in `app.json`. Light theme only (`userInterfaceStyle: "light"`). No push notifications. No offline write queue (offline disables write buttons). No screen or component tests (`npm test` covers `src/lib` only).

### Baseline

2026-09-28: `npm test` 123 passing; `npx tsc --noEmit` and `npx expo lint` clean.

## Stack

Expo SDK 57 (`expo ~57.0.24`), React Native 0.86.3, React 19.2.3 with the React Compiler on, Expo Router with typed routes, TypeScript `strict`, TanStack Query 5 for server state, `@supabase/supabase-js` for authentication only, `expo-secure-store` for the session (and the coach-mark flag), NetInfo for connectivity, Ionicons for icons, `@ronradtke/react-native-markdown-display` (pure JS, runs in Expo Go) for chat replies, imported only by `src/ui/Markdown.tsx`, `react-native-svg` (bundled in Expo Go) for the Goals `Dial`, the tab bar and the v3 illustrations, which `react-native-svg-transformer` imports as components (`metro.config.js`; `.svgrrc` keeps their ids and maps the coins' ₹ font to Barlow; `svg.d.ts` types them), `lucide-react-native` for the v3 kit's line icons, `expo-linear-gradient` for the tab-bar fade, Reanimated for `PressableScale` and the hold ring, and `@expo-google-fonts/instrument-sans`, `instrument-serif`, `jetbrains-mono` and `barlow-semi-condensed`, loaded with `useFonts` in `src/app/_layout.tsx` (the splash stays up until they load). The Instrument fonts go once no screen uses the cream primitives. See `package.json` for the rest. The package manager is npm (`package-lock.json`).

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
- `src/ui/`: primitives (`Screen`, `Button`, `Card`, `Text`, `Input`, `Amount`, `TransactionEditor`, ...). It is the only code that reads `theme.ts` (cream, being retired) and `tokens.ts` (design v3, a copy of `design/theme.ts` plus an `extra` block of values from `design/reference-html`); screens import from `@/ui`, which exports neither.
- The v3 kit in `src/ui/` (DESIGN.md §3): `Blocks.tsx` (`Title`, `Panel` = the design's Card, `IconTile` (a lucide icon or a text glyph such as ₹), Home's `HeroAmount`, `SectionLabel`, `MiniTile`, Activity's `TxRow`, `DayHeader`, `Note` (with tones for a cream sheet), `Meter` (an ink bar with an optional % tooltip) and Goals' `GoalTile`), `SearchField.tsx` (the v3 search pill), `OptionSheet.tsx` (`Sheet`, the cream bottom sheet; `OptionSheet`, what a dropdown `Pill` opens; `SheetHandle`), `CategoryTile.tsx` (a category's lucide glyph and v3 colour, mapped from `lib/categoryStyle`'s hue; `categoryTone` for legend dots; QuickAdd's `CategoryChoice` and dashed `DashedChoice`), `SpendPulse.tsx` (`PulseBubbles`, `AreaChart`, hand-drawn SVG), `Buttons.tsx` (`CircleButton` in `cream`, `outline`, `ink`, `line` and `sage` at 38 / 40 / 58, `PrimaryButton`, `SecondaryButton`, `PillButton`, `Fab`; the writing buttons share `useGuardedPress` from `Button.tsx`), `Chips.tsx` (`Chip`, `Pill`, `InlineChip`, `RichText`, whose template parser is `lib/richText.ts`, and `Toggle`, the two-way segmented switch in `ink` or `sage`), `AmountInput.tsx` (`EntryAmount`, the 86 QuickAdd figure), `Field.tsx` (`FieldButton`, `FieldInput` on a cream sheet), `DateChip.tsx`, `Dial.tsx` (the Goals dial, SVG), `BudgetList.tsx` (Budget's `ReadyCard`, `BudgetTable`, `BudgetRow`), `PickerList.tsx` (`Overlaid` puts a chooser over a form), `PressableScale.tsx`, `Illustration.tsx`, `TabBar.tsx`. Screens pass it `lucide-react-native` icons. `Screen` takes `surface` (`screen`, `sage`, `peri`, `cream`; omitted = the old cream background; a surface also switches to v3 spacing, 18 side / 8 top / 12 between blocks, and a light refresh spinner), `tabBar` (a tab root: content clears the floating bar) and `fab` (a `Fab`, with room left to scroll clear of it). `Skeleton` takes `tone` (`cream`, `dark`, `light` on a colour card) and `round` (a `tokens.radius` key). `SectionedList` takes `v3` (8 between cells, a light refresh spinner).
- `design/`: the v3 handoff. `DESIGN.md` is the look, `screens/*.png` the targets, `reference-html/*.html` the exact values, `assets/illustrations/` the SVGs (imported from there; never redrawn).
- `src/lib/`: everything that is not UI. `api.ts` (typed client), `queries.ts` and `mutations.ts` (the only way screens read and write server data, including cache keys and invalidation), `errors.ts`, `types.ts`, `network.ts`, `queryClient.ts`, `supabase.ts`, `format.ts`, `labels.ts`, and pure logic with a `*.test.ts` beside it: `money`, `dates`, `ledger`, `transactionForm` (also QuickAdd's `quickCategories` and `defaultMethod`), `budget` (also the Budget rows: `byAssigned`, `budgetRow`), `goals`, `errors`, `ids`, `chat`, `reports`, `settings`, `categoryStyle`, `home` (Spend Pulse week maths, money strings, the balance sentence).
- `src/providers/AuthProvider.tsx`: session, `signIn` / `signUp` / `signOut`, the "session expired" notice.
- Alias `@/*` maps to `src/*`.

## Rules

1. **Data goes through `queries.ts` / `mutations.ts`.** Screens never call `api` directly. `invalidateAfter()` in `queries.ts` is the only place that knows which caches a write makes stale; a new kind of write adds a `Change` case there.
2. **Errors:** never render `err.message`; use `userMessage(err, "save this expense")`. A 404 on delete or update means "already gone" (`isNotFound`). A batch stops on `stopsBatch` errors (offline, signed out, rate limited).
3. **Money is integer minor units (paise).** Parse typed text only with `src/lib/money.ts`, total with `sumMinor`, never add `display_*` floats, and show amounts with `Amount` / `formatCurrency` / `formatMinor`. Amount fields use `AmountInput`.
4. **Dates are local calendar `YYYY-MM-DD`** computed on the phone (`todayLocal`, `rangeFor`, `monthShift`). List queries send explicit `date_from` / `date_to` because the server's own "this month" follows its UTC clock. The Dashboard is the exception: it sends `period=this_month|last_month`.
5. **Visuals live in `src/ui`.** A new look becomes a primitive there, not inline styles in a screen. Text uses the `theme.type` / `theme.font` families, whose weight is in the family name: never set `fontWeight` (Android fakes it). Money uses `Amount`, which is serif. Category colours and emoji come only from `lib/categoryStyle.ts` (through `CategoryIcon` and `ProgressBar`'s `category` prop).
6. **Pure logic in `src/lib`** is import-free or imports siblings with an explicit `.ts` extension, so `node --test` runs it without a bundler. A module that imports `@/...`, React or React Native cannot be tested that way.
7. **Every data screen handles Loading (`Skeleton`), Success, Empty (`EmptyState`) and Error (`ErrorState` with retry).** If cached data exists and a refresh fails, keep showing it with `Banner tone="warning"` ("Couldn't refresh. Showing ..."). Tab roots support pull-to-refresh and `useRefetchStaleOnFocus()`.
8. **Forms and writes:** guard unsaved input with `useDiscardGuard`; destructive actions go through `confirm()`; success is `hapticSuccess()` plus `showToast()`. Writing buttons use `requiresNetwork` and are disabled while pending; the API has no idempotency for transactions, so that guard is what stops a double tap.
9. **Routes that take an id from the URL** validate it with `isUuid()` and show `NotFoundScreen` otherwise.
10. **Auth:** the session is kept in SecureStore (split into chunks because values can exceed ~2 KB; web falls back to localStorage). On a 401 the client refreshes the token once (single-flight), retries once, then signs out locally; `SIGNED_OUT` clears the whole query cache. Supabase is used for authentication only: all data goes through the FastAPI API with `Authorization: Bearer <access token>`, and the `anon` / `authenticated` database roles have no table privileges, so never query Supabase tables directly.
11. **Network:** `networkMode: "always"`. `useOnline()` means only "no connection at all" and drives the offline banner and `requiresNetwork` buttons. Default `staleTime` 30 s, one retry except on 4xx, no refetch on reconnect (it only marks data stale). Timeouts: 15 s for CRUD, 60 s for chat.
12. **Comments:** short tags (`C4`, `L3`, `A1`, ...) mark edge cases handled on purpose, so keep them intact when editing nearby code. A `ponytail:` comment marks a deliberate shortcut and names its ceiling and upgrade path; read it before changing that code.

## Design v3 rules

From `design/CLAUDE.design.md`, with its paths adapted to this app (the kit is in `src/ui`, not `src/components` / `src/theme`):

- Visual source of truth: `design/DESIGN.md`, `design/theme.ts` (copied to `src/ui/tokens.ts`) and `design/screens/*.png`. Exact values (padding, radius, sizes, copy) are in `design/reference-html/*.html`: read them instead of guessing.
- Colours, fonts, radii and durations come from `src/ui/tokens.ts`; never hardcode hex or font names outside `src/ui`. Screens compose the kit and never write one-off styles for something it covers.
- Titles are uppercase Barlow Semi Condensed; all body copy is JetBrains Mono. No emoji in rebuilt screens (category icons are lucide glyphs on `IconTile`s).
- Tabs are Home · Activity · [AI chat] · Budget · Profile, drawn by `TabBar` (no container, border or hairline; DESIGN.md §5). The centre opens Chat on tap and the QuickAdd sheet on a 350 ms hold (medium haptic, a ring fills while held; screen readers get an "Add a transaction" action). Every tab uses the dark bar (the design's `marigold` surface is unused since Budget turned charcoal), and `coachOn` names the tab that shows the first-run coach mark (Activity). The bar hides while the keyboard is up.
- A rebuilt screen is compared side by side with its PNG before moving on. The owner tests in Expo Go; `/kit` (Profile → Design kit, dev builds) shows every kit variant.

## Backend contract the client relies on

The API lives in `../ai_service/` (details in `../AGENTS.md`). `src/lib/types.ts` mirrors its response shapes by hand (no codegen): when a backend schema or route changes, update `types.ts` and `api.ts` in the same change.

- **One balance, no accounts or transfers.** The Dashboard's `current_balance` is income + starting balances - expenses. Each transaction has an optional `payment_method`: `cash`, `upi`, `bank_transfer`, `card` or `other`.
- **Amounts** are integer minor units; every money field also has a `display_*` float for display only.
- **Transaction types** are `expense`, `income` and `starting_balance`. Expense and income need a category of the same type. The add form offers Expense and Income only; a starting balance can be viewed and edited but not created in the app.
- **Categories and payees** are per user and seeded on the first `GET /profile` (36 each). A category's `type` cannot change. `DELETE /categories/{id}` archives it (hidden from lists, still shown on old transactions and budgets). `POST /categories` and `POST /payees` return the existing row when the name already exists, and `payee_name` on a new transaction finds or creates the payee. A category's `color` is saved as one of the 8 hue `bar` hexes in `lib/categoryStyle.ts` (what the web's swatches write too); the seeded rows carry other hexes and word icons (`"food"`), so the app ignores those and uses the name's hue and emoji.
- **Budgets:** `POST /budgets` is an upsert per category and month; `GET /budgets/YYYY-MM` returns `spent`, `remaining` and `percent_used`. Only active expense categories can be budgeted.
- **Goals** have no GET-by-id and no DELETE. The app finds a goal in the cached Active / Achieved lists, and archiving (`PATCH status=archived`, on the Edit screen) is the removal path. The server sets `status` to `completed` when `current_amount >= target_amount`, and back to `active` if it drops below, unless a `status` is sent or the goal is archived. Contributing sends `current_amount = cached + amount` (there is no atomic contribute endpoint), so two devices contributing at the same moment lose one; this is deliberate and marked with `ponytail:` in `goals/[id]/contribute.tsx`.
- **Transactions list:** `limit` 1 to 100 (the app uses 20), `offset`, and filters `transaction_type`, `category_id`, `payee_id`, `cleared_status`, `date_from`, `date_to`, `period`.
- **Limits and failures:** the API rate-limits per access token, or per IP when there is none (defaults in `ai_service/core/config.py`: 60 per minute for financial routes, 30 for profile, 20 for chat), and a 429 carries `Retry-After`. A 409 is a conflict (duplicate or racing insert); a 401 carries `WWW-Authenticate: Bearer`.
- **Chat:** `api.chat` (60 s timeout), `listConversations` (History shows the 50 newest), `getMessages` and `deleteConversation`; `MSG.busy` is the 409 "Still processing". A message is at most 4000 characters and an agent turn can take up to 60 s. Each new send gets a fresh `idempotency_key` (`newIdempotencyKey`), and a retry of a failed send reuses its key: the server replays a finished send, answers 409 while it is still running and reruns a failed one. `getMessages` returns the newest page in chronological order; the app asks for 500 rows and has no "Load earlier" (`ponytail:` in `queries.ts`). History rows carry no tool calls and reasoning is not stored, so tool cards and "Thinking" show only on the reply that just arrived. A tool card's header is `toolSummary` (parsed from the tool's JSON output, falling back to the tool name); the raw input and output stay behind the expander. `useSendMessage` writes both messages into the thread's cache in the hook options (so they land even if the user left the screen), then invalidates `conversation` plus whatever the reply's tools changed (`changesFromTools`: transactions, payees, budgets, goals). History won't delete a conversation whose reply is still on its way.

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
