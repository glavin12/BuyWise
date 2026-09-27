# Design rules (append this to your repo's CLAUDE.md)

- Visual source of truth: `design/DESIGN.md` + `design/theme.ts` + `design/screens/*.png`.
  `implementation_plan.md` §8 tokens are superseded — do not use the cream theme.
- Exact values (padding, radius, sizes, copy) live in `design/reference-html/*.html` — read them instead of guessing.
- Import every colour, font, radius and duration from `src/theme` — never hardcode hex or font names in components.
- Screens compose kit components from `src/components/`; they never write one-off styles for things the kit covers.
- Titles are uppercase Barlow Semi Condensed; ALL body copy is JetBrains Mono. No other fonts.
- No emoji anywhere in the UI (category icons are SVG glyphs on colour tiles).
- The tab bar has no container, border or hairline — see DESIGN.md §5. Centre tab: tap = AI chat, long-press (350ms) = QuickAdd sheet.
- Illustrations come from `design/assets/illustrations/` via react-native-svg; never redraw or substitute them.
- After building a screen, compare it side by side with its PNG in `design/screens/` and fix differences before moving on.
