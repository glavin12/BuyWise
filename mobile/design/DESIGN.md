# BuyWise Mobile — Design Spec (v3, "Vintage cartoon × charcoal product UI")

This file is the **visual source of truth**. `implementation_plan.md` stays the source of truth for
*what* to build (features, API, state, edge cases) — but its §8 design tokens are **superseded** by
this file and `theme.ts`.

Look at `screens/*.png` for the target. `reference-html/*.html` hold the exact values (padding,
radius, sizes, copy) — read them when a number is unclear; they're plain HTML/CSS.

---

## 1. The aesthetic in one paragraph

A charcoal, grown-up product UI with **1930s rubber-hose cartoon illustration** living inside it.
Solid colour blocks (no gradients), big rounded cards, **condensed uppercase titles**, and **all body
copy in monospace** with small boxed **inline data chips** (`₹4,860`) embedded in sentences. Cards
behave like physical objects: stacked like envelopes, tossed like tickets, sliding like sheets.

**Never:** emoji, gradients on cards, outline-only "wireframe" icons in the tab bar, hairline rules on
the tab bar, Inter/Roboto, lorem, generic card grids.

## 2. Illustration cast

| Asset | Where | Notes |
|---|---|---|
| `login_hero.svg` 390×372 | Login top | Gullak waving, coins dropping into the slot, coin buddy, sun, hill |
| `budget_plate.svg` (render 300×216) | Budget front envelope card | Gullak juggling envelopes, cropped by card |
| `avatar_user.svg` | Home greeting (42), Profile card (56), tab bar (28) | Default avatar until a photo exists |
| `avatar_ai.svg` | AI chat bubbles (30) | The coin buddy = the AI |
| `goal_badge.svg` (128) | Reports savings-rate card, goal celebration | Cheering coin buddy |

Use `react-native-svg` + `react-native-svg-transformer` to import SVGs as components (they use
`<pattern>` halftone and `<clipPath>` — both supported). If an SVG misbehaves on Android, fall back to
`png/*@3x.png`. The ₹ inside coins is SVG `<text>`: load Barlow Semi Condensed before rendering, or
accept the fallback glyph. New poses: `assets/source/gen.py` + `plates.py` (Python, outputs SVG).

## 3. Component kit (build these first, screens only compose them)

| Component | Spec |
|---|---|
| `CircleButton` | 40 (38 in cards), cream bg, ink icon 18 / stroke 2.3. Variants: `outline` (transparent, 1.5 border `#8A8880`, text-colour icon), `ink` (ink bg, cream icon). Used for back ←, ↗, search, bell, edit, history. |
| `Title` | `type.title`, uppercase, can be 2 lines ("MONEY / BUDDY"). |
| `Pill` (dropdown) | Cream filled, radius pill, mono 11–12, trailing chevron 13. `knob` variant: chevron inside a 28–32 ink circle at the right (Home month selector, full width, height 44). |
| `Chip` | Pill, mono 10–11, optional 8px colour dot or 13px icon. Variants: cream, outlined (1.4 ink), ink-filled, lavender tag (category), translucent. |
| `InlineChip` | Radius 6, padding 0×6, inside mono prose. Kinds: `dark` (#1C1C1E + 1px line), `hi` (marigold), `mint`, `coral`. Some are links (tap → Budget / Goals). |
| `RichText` | **RN can't pad/round nested `<Text>`** — build a row `flexWrap:'wrap'` that splits a template like `"Up {mint:+₹17,860} this month."` into word `Text`s and `InlineChip` `View`s. Line height 21. |
| `IconTile` | Rounded square (44/r14, 30/r10, 58/r19), category colour, ink glyph stroke 2.1. |
| `Card` | `card` bg, radius 24, padding 14. |
| `PrimaryButton` | Tomato, radius pill, height 58–60, label = display 20–21 uppercase left, **44 ink circle with cream icon at right end** (↗ / ✓ / +). |
| `SecondaryButton` | Transparent, 1.8 ink border (or `line` on charcoal), mono 12 bold. |
| `TabBar` | See §5 — custom, no container. |
| `Sheet` | `@gorhom/bottom-sheet`, cream bg, radius 34 top, 46×5 handle `#C9C1AF`. |
| `EnvelopeStack` | Tabs overlap by 22 (`marginTop:-22`), top radius 24, padding-bottom 34 so the next tab covers it, shadow `0 -6 14 rgba(0,0,0,.12)`. Front card radius 26, `overflow:hidden`, illustration anchored inside. |
| `Ticket` | Height 104, main part radius 24 left, 104-wide stub with an 18-radius ink block inside, two 18px notch circles (screen colour) at the seam, `rotate` −5…+4°, 12px vertical gap, drop shadow. |
| `Dial` | react-native-svg: cream face, 120 ticks (every 10th longer/darker), 30-wide tomato progress arc over `#E4DCCB` track, ink inner ring, ink knob with marigold centre at the arc end. |
| `PulseBubbles` | 7 × 34px circles. past = peri2/white text, today = cream/ink bold, future = dashed `rgba(255,255,255,.55)` border. |
| `AreaChart` | SVG, tomato fill up to today, ink 2.6 line, cream dots with ink stroke, dashed white forecast over a hex pattern, dotted ink marker line + ink tooltip pill. No chart library. |
| `DottedColumns` | Income column mint (radius 14 top), spent portion mint2 from bottom, dotted centre line, selected month = 2.5 ink outline + ink month pill + ink tooltip. |

## 4. Screens

| Screen (plan §6 name) | Background | Key composition |
|---|---|---|
| **Login** | sage top (0–480) + charcoal sheet (bottom 410, radius 34) | Wordmark → `login_hero` → sheet: title "MONEY THAT TALKS BACK.", mono line with inline chip, 2 fields (card bg, radius 17, leading icon), PrimaryButton "LOG IN", "Create an account" link underlined tomato. |
| **Home** (Dashboard) | charcoal | Avatar + "Hi, Bhagy!" + outline search/bell → month Pill(knob) → Balance card (marigold ₹ tile, "TOTAL BALANCE", ↗, 40px amount, RichText with *budget* and *goals* chips as links) → Spend Pulse (peri card: bubbles, area chart, legend chips) → RECENT: 3 compact tiles. |
| **Activity** (TransactionList) | charcoal | Title + "all" pill → search pill (card bg, mono placeholder, voice glyph) → filter chips + month pill → "47 transactions found" → date headers (TODAY + net inline chip) → rows: IconTile 46, uppercase payee, mono meta, lavender category tag, amount right. First-run coach mark above centre tab. |
| **Quick Add** (sheet) | cream sheet over charcoal | "ADD EXPENSE" + close → ink segmented Expense/Income (tomato selected) → ₹ + 86px amount + tomato caret → mint "Swiggy → Food & Dining, like last time" chip (plan 5A #1) → category tiles 58 (selected: ink border + check badge, last = dashed "New") → payee field → method chips (UPI ink-filled) → PrimaryButton "SAVE ₹250" (✓) → "Save & add another". |
| **Budget** | **periwinkle** | Title + month pill → cream "READY TO ASSIGN" card (breakdown line, ink "Copy Aug" button) → EnvelopeStack: Rent (tomato, ✓), Groceries (charcoal, over-budget in tomato), Transport (mint, "not budgeted" + Set) → front marigold card = selected envelope: title, chips, progress with % tooltip, editable "budgeted ₹8,000 ✎" (dotted underline, plan 5A #9), `budget_plate`. Tab bar uses **marigold surface**. |
| **Goals** | sage | Back + title + Active/Achieved segmented (ink selected) → Dial 310 with centre text → two corner chips (days left / per month) → PrimaryButton "CONTRIBUTE" + edit circle → 2 goal cards (mint, sky) → marigold + FAB (stack screen, no tab bar). |
| **AI Chat** | charcoal | Back + "MONEY BUDDY" + history → AI bubble (card, avatar_ai, RichText) → right-aligned quick replies (mint, forest) → tool chip "Checked Food & Dining · 14 orders ⌄" (human-readable, plan 5A #7) → AI bubble with markdown table + "view reasoning ⌄" → input row: card-colour + circle, card pill input with voice glyph. |
| **Reports** (tall/scroll) | charcoal | Back + title + 2 pills → tomato panel: two tomato2 stat cards with cream badges, DottedColumns (6 months) → mint savings card with `goal_badge` → By category (segmented bar + rows) → 3 comparison tiles → payment methods bars. |
| **Profile** (Settings) | charcoal | Title "PROFILE" → profile card (avatar 56, name, email, edit) → Tickets: Categories (tomato), Payees (marigold), Budget alerts (sky, toggle in stub), Region (mint) → Sign out (outlined, tomato text). |

## 5. Tab bar — IMPORTANT (changed from plan §6)

Tabs: **Home · Activity · [AI chat] · Budget · Profile(avatar)**. No labels.

- **No container, no border, no hairline.** A `LinearGradient` (expo-linear-gradient) 128 tall from
  `fade@0` → `fade@0.92` (42%) → `fade` (70%) sits behind icons; icons row is 20px above the bottom
  safe area, spread `space-between`, 14px side inset.
- Icons are **solid rounded shapes** 26px (house, three bars, wallet) — idle `tabIdle`, active `text`
  plus a 5px tomato dot under it. Profile = avatar 28 with a 2px ring when active.
- **Centre = 62px circle**, cream, solid speech bubble + sparkle, marigold 21px **+ badge** top-right.
  - `onPress` → Chat tab. On the Chat screen the circle turns tomato.
  - `onLongPress` (`delayLongPress: 350`) → open QuickAdd sheet, `Haptics.impactAsync(Medium)`.
    While pressed: scale 0.94 and a ring filling around the circle over 350ms.
- **Surface-aware:** Budget passes `tabSurface.marigold` (fade inset 12px to match the card).
- The old centre "+" FAB and yellow floating FAB are gone. Settings is now the **Profile** tab
  (was a stack reached from the avatar).
- Stack screens (Goals, Reports, Chat conversation, TxnDetail) keep a back CircleButton.

## 6. Motion (Day 7 polish, except the first three)

1. Card entrance: translateY 16→0 + opacity, 320ms, 60ms stagger (ship with screens).
2. `PressableScale` 0.97 on every card/button (ship with kit).
3. Chat composing dots (ship with chat).
4. Balance/"ready to assign" count-up 240ms on fresh data. Dial arc + progress bars draw on mount.
5. Envelope deck: tapping a back tab springs it to the front (layout animation).
6. Tickets settle from rotate(0) to their tilt on mount with a spring.
7. Goal completion: dial pop + coin buddy celebration + confetti + success haptic.
8. Respect `isReduceMotionEnabled` → cross-fades only.
