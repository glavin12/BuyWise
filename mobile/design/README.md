# BuyWise design handoff → Claude Code

## 1. Put it in your repo

```
your-app/
├── implementation_plan.md        ← your existing plan (the WHAT)
├── CLAUDE.md                     ← append CLAUDE.design.md to it
└── design/                       ← this whole folder
    ├── DESIGN.md                 ← the LOOK (spec)
    ├── theme.ts                  ← tokens → copy to src/theme/index.ts
    ├── screens/*.png             ← target renders (390pt wide, @2x)
    ├── reference-html/*.html     ← exact values; open in a browser too
    └── assets/illustrations/     ← SVG (+ png/@3x fallbacks)
```

Commit it, then run `claude` from the repo root.

## 2. Work in phases — one prompt per phase, review between

Paste these in order. Each is sized to finish in one sitting; check the result on your device /
simulator against the PNG before moving on (you can drag a screenshot into Claude Code and say
"compare with design/screens/02-home.png").

**Phase 0 — orient (plan mode: press Shift+Tab until it says plan mode)**
```
Read implementation_plan.md, design/DESIGN.md, design/theme.ts and look at every PNG in
design/screens. Design/DESIGN.md overrides §8 of the plan and changes the tab bar (§5 of DESIGN.md).
Propose the folder structure and the order you'll build the component kit in. Don't write code yet.
```

**Phase 1 — foundation**
```
Set up theme and fonts: copy design/theme.ts to src/theme/index.ts, install
@expo-google-fonts/barlow-semi-condensed and @expo-google-fonts/jetbrains-mono, load them in the
root layout, and set up react-native-svg + react-native-svg-transformer so I can import the SVGs in
design/assets/illustrations as components. Render all 5 illustrations on a temporary test screen.
```

**Phase 2 — component kit**
```
Build the component kit from DESIGN.md §3 in src/components: CircleButton, Title, Pill, Chip,
InlineChip, RichText, IconTile, Card, PrimaryButton, SecondaryButton, PressableScale. Use only
theme tokens. Add a /kit dev screen that shows every variant so I can check them.
```

**Phase 3 — the tab bar**
```
Build the custom tab bar from DESIGN.md §5 for @react-navigation/bottom-tabs: Home, Activity,
centre AI chat, Budget, Profile(avatar). No container/border — expo-linear-gradient fade. Centre:
onPress → Chat, onLongPress (350ms) → open the QuickAdd bottom sheet with a medium haptic and the
press ring animation. Support the 'marigold' surface for the Budget screen via a screen option.
```

**Phase 4+ — one screen per prompt** (follow the plan's day order)
```
Build the Home screen exactly like design/screens/02-home.png (values in
design/reference-html/Dashboard.html), wired to GET /api/v1/dashboard per implementation_plan.md
§4 and §7. Include loading skeletons, empty state and pull-to-refresh. Charts are hand-drawn with
react-native-svg — no chart library.
```
Repeat for: Activity (03), Quick Add sheet (04), Budget (05), Goals (06), AI Chat (07),
Reports (08), Profile (09), Login (01).

**Last — polish**
```
Implement DESIGN.md §6 motion with Reanimated, respecting reduce-motion. Then audit every screen
against its PNG and list mismatches before fixing them.
```

## 3. Tips that save hours

- **Show, don't describe.** When something looks off, screenshot the simulator, drop it into Claude
  Code, and name the target PNG. Visual diffs beat paragraphs.
- **Keep sessions focused.** One screen per session; `/clear` between screens so the context stays
  on the design files, not old code.
- **Inline chips need `RichText`.** React Native can't pad or round nested `<Text>` — that's why the
  kit has it. If chips render as flat highlights, that's the cause.
- **Android shadows** use `elevation`; tickets/sheet shadows may need `react-native-shadow-2` for
  the soft look.
- **Plan changes to note:** Settings became the Profile tab; the centre tab is AI chat (hold =
  new transaction); the floating FAB is gone. Ask Claude Code to update `implementation_plan.md` §6
  so the plan and the design agree.
