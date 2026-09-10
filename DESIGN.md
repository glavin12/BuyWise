# BuyWise Frontend Design

This file is the UX/UI reference for the BuyWise web frontend. It exists to keep the
frontend consistent as it's built out for review and basic testing. It is not a pixel
spec — it's the set of decisions that stop every screen from being designed from
scratch.

Scope note: this is an **MVP review build**. It's for internal/user testing of the
manual expense tracking flow, not a production launch. Where the "right" answer would
take real design/eng time (native mobile, animation polish, offline mode), this doc
says so and points at the cheaper version instead.

## 1. Who we're borrowing from, and why

BuyWise is manual-entry, AI-first, and ledger-accurate under the hood. No single
existing app matches that combination, so the design borrows different things from
different apps rather than cloning one:

- **YNAB** — for the *budget* screen and its vocabulary. YNAB's core trick isn't
  visual, it's linguistic: it describes budgeting in plain language ("give every
  dollar a job," "age of money") instead of finance jargon, and its budget editor
  gives live feedback the moment a number changes. We borrow the envelope-style
  category list and the plain-language framing, not YNAB's onboarding quiz or its
  bank-sync flow (BuyWise has neither).
- **Copilot Money** — for the *daily review* feel: a single clean transaction list,
  fast categorization, minimal chrome. Copilot's reputation is built on how good the
  five-minute daily check-in feels, which matters a lot for a manual-entry app since
  the user is the one doing the data entry work YNAB/Copilot's bank sync normally does.
- **Monarch Money** — for the *dashboard* and *cross-device consistency*: a
  professional, unflashy layout where net worth, budget status, and recent activity
  are visible without digging, and the web layout uses the same structure a mobile
  view would later use.

What we deliberately leave out: bank-linking flows (Plaid/Yodlee-style — BuyWise is
manual), multi-user household accounts, gamified onboarding quizzes, and native-app-only
patterns (swipe gestures, haptics). Those are real reasons those apps look the way they
do, but they don't apply here.

## 2. Design principles

1. **Every number is a real amount, not a float.** The backend stores integer minor
   units and returns paired `amount` / `display_*` fields. The frontend must always
   render `display_*` for currency and never re-derive display strings by dividing
   minor units in JS. This avoids a whole class of rounding bugs showing up in the UI.
2. **Plain language over finance jargon.** Labels read like a person talking, not a
   ledger. "Left to spend" not "residual allocation." "Cash" not "primary demand
   account." This is the one UX idea taken directly from YNAB.
3. **The list is the product.** Transactions, categories, budgets, and goals are all,
   fundamentally, lists with a total. Build one strong list/table component and reuse
   it everywhere instead of bespoke layouts per screen.
4. **Add a transaction in under 10 seconds.** Manual entry only works if entry is
   fast. Quick-add is a persistent, keyboard-friendly affordance, not a page navigation.
5. **State honestly, fail loudly, never guess silently.** If a category was deleted
   and a transaction references it, show "Uncategorized," don't hide the transaction.
   If a request fails, say so — don't show stale numbers as if they're current.
6. **Chat is a second way in, not the only way in.** The AI chat (`/api/v1/chat`) is a
   first-class entry point for "add ₹450 for groceries" style input, but every action
   it can do must also be reachable through a normal form. Nobody should be forced to
   use the chat to use the app.

## 3. Information architecture

```
Sidebar (persistent, desktop) / Bottom nav (mobile, MVP-lite)
├── Dashboard          → GET /api/v1/dashboard
├── Transactions        → GET/POST /api/v1/transactions, /transfers
├── Budget (YYYY-MM)    → GET/POST /api/v1/budgets
├── Accounts            → GET/POST /api/v1/accounts
├── Goals               → GET/POST /api/v1/goals
├── Reports             → GET /api/v1/analytics/*
├── Chat                → POST /api/v1/chat, /api/v1/conversations
└── Settings
    ├── Categories       → /api/v1/categories
    ├── Payees           → /api/v1/payees
    └── Profile          → /api/v1/profile
```

Persistent chrome:
- **Left sidebar** (collapses to icon rail under ~1024px) with the seven primary
  sections above.
- **Global quick-add button** (`+ Add transaction`), always visible top-right of the
  content area, opens a modal — never navigates away from the current screen.
- **Month switcher**, visible on Dashboard, Budget, and Reports, since those three all
  key off a period. One shared component, not three separate date pickers.

## 4. Visual system

Keep this small on purpose — a limited palette and two type sizes styles per role is
easier to keep consistent through an MVP than a large token set.

### Color

Money apps live or die on whether "is this good or bad" is instantly readable, so
color carries real meaning here, not just brand decoration.

| Token | Use | Example |
|---|---|---|
| `--surface` | App background | near-white / near-black in dark mode |
| `--surface-raised` | Cards, modals, table rows on hover | slightly lighter than surface |
| `--border` | Dividers, input borders | low-contrast gray |
| `--text-primary` | Headings, amounts | near-black / near-white |
| `--text-secondary` | Labels, metadata, timestamps | mid gray |
| `--brand` | Primary actions, active nav item | a single accent (pick one hue — teal or indigo both read as "trustworthy fintech" without being a bank-blue clone) |
| `--positive` | Income, under-budget, goal progress | green |
| `--negative` | Expenses shown as reducing balance, over-budget | red — used for *status*, not for every expense row |
| `--warning` | Nearing budget limit, unfunded category | amber |
| `--neutral-transfer` | Transfers | a desaturated tone distinct from both income and expense so transfers never get misread as either |

Rule: don't color every expense row red. YNAB and Copilot both keep the transaction
list in neutral text and reserve red/green for *status* (over budget, under budget,
account balance sign) — coloring every row destroys the signal.

### Typography

- One typeface, variable weight (e.g. Inter or system-ui stack) — a finance app
  doesn't need a display font, and a second typeface is a maintenance cost this MVP
  doesn't need to take on.
- Tabular figures (`font-variant-numeric: tabular-nums`) on every number so amounts in
  a list align in a column instead of jittering per-digit-width. This one CSS rule
  does more for "feels professional" than almost anything else in this doc.
- Scale: 12 / 14 / 16 / 20 / 28px. Body text 14px, table amounts 14–16px, dashboard
  hero numbers (net worth, left-to-spend) 28px.

### Spacing & shape

- 8px base spacing unit.
- 8px corner radius on cards/inputs, 6px on badges/pills — consistent, not sharp,
  not overly rounded.
- Cards get a 1px border, not a heavy shadow. Monarch's flat, low-shadow style ages
  better than the deep-shadow "neumorphic" trend and is cheaper to build.

## 5. Core screens

### 5.1 Dashboard (`GET /api/v1/dashboard`)

The Monarch-style "everything at a glance" screen. Top to bottom:

1. **Header row**: total balance across active accounts, month switcher, quick-add.
2. **This month at a glance**: three stat cards — Income, Expenses, Left to Spend —
   using `--positive` / `--negative` / neutral respectively.
3. **Budget snapshot**: top 3–5 categories closest to their limit, each a thin
   horizontal bar (spent vs. budgeted), with a "See full budget" link out to the
   Budget screen rather than duplicating the whole envelope list here.
4. **Recent transactions**: last 5–8 rows, reusing the shared transaction list
   component in its compact variant, "View all" link to Transactions.
5. **Goals strip**: horizontal scroll of goal progress cards (small ring or bar +
   percent), only shown if goals exist — don't show an empty goals section by default.

Empty state (new user, no transactions yet): replace the stat cards with a single
prompt — "Add your first transaction to see your spending here" — with the quick-add
button front and center. Never show a dashboard full of zeros as the first thing a new
user sees.

### 5.2 Transactions (`/api/v1/transactions`, `/api/v1/transfers`)

- A single dense, sortable, filterable table: date, payee, category (as a colored
  tag), account, amount (right-aligned, tabular figures).
- Filter bar: date range (defaults to current month, reuses the month switcher
  pattern), account, category, type (income/expense/transfer).
- Row click opens an **inline edit**, not a page navigation — editing a transaction
  shouldn't lose your place in the list. Copilot and Monarch both do this; it's the
  single biggest thing that makes a transaction list feel fast instead of tedious.
- Transfers render as a single logical row (both legs of the `transfer_group_id`
  collapsed into one line with a transfer icon), not as two separate rows that look
  like duplicate transactions.
- Bulk select + bulk categorize/delete is a nice-to-have, not MVP-required — skip it
  for the review build unless testers ask for it.

### 5.3 Quick-add (modal, available from anywhere)

This is the highest-leverage component in the app, because BuyWise has no bank sync —
every transaction is typed in by hand.

- Fields, in tab order: Amount, Payee (autocomplete against existing payees, allows
  free text for new ones), Category (searchable dropdown, grouped like the budget
  envelope groups), Account, Date (defaults to today), Type toggle
  (Expense/Income/Transfer — Transfer swaps Category for a "To account" field).
- `Enter` submits and reopens a blank form (for rapid multi-entry); `Esc` closes.
- Amount field accepts plain numbers and converts client-side to minor units only at
  submit time, using the same rounding rule as `amount_to_minor()` — never do
  ad-hoc float math on the amount in the UI layer.

### 5.4 Budget (`/api/v1/budgets/{YYYY-MM}`)

This is the YNAB-inspired screen and the one worth the most design care.

- Categories grouped the same way `get_categories` groups them, each group
  collapsible.
- Each category row: name, budgeted amount (inline-editable — click the number, type,
  it saves), spent this month, remaining. Remaining goes amber near zero, red if
  negative (over budget), matching the color rules in §4.
- A persistent header total: "Left to Budget" (income minus everything assigned) —
  this is the YNAB "give every dollar a job" number, and it should update live as the
  user edits category amounts, before they even save.
- Month switcher navigates between `YYYY-MM` periods; a "Copy last month's budget"
  action saves re-entering the same numbers every period, which matters a lot for a
  manual-only app.

### 5.5 Accounts, Categories, Payees, Goals

These are CRUD-on-a-list screens and should all reuse the same list/table + modal-form
pattern rather than each getting a bespoke layout:

- **Accounts**: name, type, current balance (computed, not user-entered), active
  toggle. Deactivating (not deleting) is the primary "remove" action, matching how the
  backend treats `active` accounts in balance calculation.
- **Categories**: grouped list, inline rename, archive instead of hard-delete where
  the category has transaction history.
- **Payees**: simple searchable list; mostly exists as an autocomplete source for
  quick-add rather than a screen users visit often.
- **Goals**: card grid, each card a progress ring + target amount + "Update progress"
  action wired to `update_goal_progress`.

### 5.6 Reports (`/api/v1/analytics/*`)

Three tabs, one per backend endpoint — resist merging them into one mega-chart:

- **Monthly** (`analytics/monthly`): income vs. expense over time, simple bar chart.
- **Categories** (`analytics/categories`): spending breakdown, donut or horizontal bar
  list (horizontal bars read better than a pie once there are more than ~6 categories
  — Copilot uses this pattern for exactly that reason).
- **Comparison** (`analytics/comparison`): this month vs. last month, side-by-side
  bars per category, so overspending is visible at the category level, not just the
  total.

### 5.7 Chat (`/api/v1/chat`, `/api/v1/conversations`)

- Docked panel (slide-in from the right on desktop, full-screen on mobile), not a
  separate page — the point is that it can be open *while* looking at the budget or
  transactions.
- Conversation list is secondary; most sessions are one-off, so default to a fresh
  conversation rather than surfacing history first.
- When the agent uses a tool (e.g. `add_transaction`), show a small structured
  confirmation card in the chat thread ("Added ₹450 expense — Groceries, Cash
  account") instead of just the raw text reply — this reuses the transaction row
  component from §5.2 at small size, so it looks like the rest of the app instead of
  like a chatbot bolted on.

## 6. Component inventory (build these once, reuse everywhere)

- `AmountText` — renders `display_*` values, tabular-nums, colored by sign/context per
  §4. Every currency amount in the app goes through this component, no exceptions.
- `TransactionRow` — full and compact variants, used on Dashboard, Transactions, and
  Chat confirmations.
- `CategoryTag` — colored pill, used in the transaction table, quick-add, and budget.
- `MonthSwitcher` — shared by Dashboard, Budget, Reports.
- `ListTable` — generic sortable/filterable table shell that `TransactionRow` and
  friends render into.
- `Modal` / `InlineEditableField` — the quick-add modal and every inline edit (budget
  amounts, transaction fields) share these two primitives.
- `EmptyState` — icon + one-line message + primary action; used on every list screen
  before any data exists, not just the dashboard.
- `ProgressBar` / `ProgressRing` — budget category bars and goal cards share the same
  underlying primitive at different shapes.

## 7. Responsive behavior

MVP target is **desktop-first, usable on mobile web** — not a native app and not a
fully bespoke mobile layout:

- Sidebar → icon rail at <1024px, → bottom tab bar at <640px (Dashboard, Transactions,
  Budget, More).
- Quick-add modal becomes a full-screen sheet on mobile rather than a centered dialog.
- Tables collapse to stacked cards below ~640px (date/amount on top line, payee/category
  below) rather than horizontal-scrolling a table — horizontal scroll tables are the
  single most common mobile-web complaint in finance app reviews and are cheap to avoid.

## 8. Accessibility baseline

Minimum bar for the review build, not a full audit:

- All interactive elements reachable and operable by keyboard (quick-add especially —
  see §5.3 tab order).
- Color is never the only signal — over-budget also gets an icon/label, not just red
  text, for colorblind users.
- Contrast: body text and amounts meet WCAG AA against `--surface`.
- Form inputs have visible labels, not placeholder-only labels.

## 9. Suggested stack

Not prescriptive, but worth naming so screens don't diverge:

- React + TypeScript, Tailwind for styling (matches the token-based approach in §4
  directly — CSS variables map onto Tailwind theme extension).
- A headless component library (Radix or shadcn/ui) for Modal, Dropdown, Tabs — don't
  hand-roll accessibility-sensitive primitives for an MVP.
- Recharts for the Reports charts — simple API, matches the "no bespoke chart per
  screen" principle in §6.
- Supabase JS client for auth, matching the backend's Supabase JWT verification.

## 10. Explicitly out of scope for this pass

Call these out so nobody spends review-build time on them:

- Bank/Plaid-style account linking (BuyWise is manual-entry by design).
- Multi-user / household sharing (backend is single-owner per row today).
- Native mobile apps — mobile web only.
- Animated onboarding, gamified quizzes, or a YNAB-style guided budget setup wizard.
- Dark mode as a full second design pass — ship semantic tokens (§4) so it's *possible*
  later, but don't hand-tune it now.

## 11. Open questions for the next design pass

- Do budgets need a rollover indicator (unspent amount carrying to next month), or is
  that a v2 feature? Affects whether the Budget screen (§5.4) needs a "rolled over"
  badge now or later.
- Should transfers between accounts show up in the Reports screens at all, or are they
  correctly excluded everywhere the way analytics currently excludes them?
- Goal cards (§5.5) — do we need a "contribute from account X" action wired to a real
  transaction, or is `update_goal_progress` purely a manual number for now?
