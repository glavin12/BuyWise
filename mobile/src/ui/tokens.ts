// BuyWise mobile — design v3 tokens, copied from design/theme.ts (keep the two in sync;
// `extra` at the end is ours). Only src/ui reads this file. Never hardcode hex or font names elsewhere.

export const colors = {
  // neutrals
  ink: '#161616',        // outlines, text on light/colour blocks
  screen: '#242426',     // default charcoal screen
  card: '#333335',       // raised card on charcoal
  card2: '#3E3E41',      // nested/pressed card, table header
  line: '#4A4A4E',       // hairlines inside cards, outlined chips (never on the tab bar)
  text: '#F3F1EA',       // primary text on charcoal
  muted: '#AAA8A0',      // secondary text on charcoal (7:1 on screen)
  sage: '#D9E4D5',       // light screen (Login top, Goals)
  sage2: '#C4D3C0',      // controls on sage
  cream: '#F3EEE2',      // pills, circle buttons, sheets
  creamField: '#E5DECF', // input field on a cream sheet

  // colour blocks
  tomato: '#F0604A',     // primary action, spend, alerts
  tomato2: '#F37863',    // stat cards inside the tomato panel
  peri: '#6E67EE',       // Budget screen, Spend Pulse card
  peri2: '#8C86F3',      // past-day bubbles, shopping
  marigold: '#F4C443',   // highlights, envelope front card, + badge
  mint: '#BEE3CB',       // income, positive, quick replies
  mint2: '#8FC9A6',      // "spent" portion in income-vs-spend columns
  sky: '#A9D8EE',        // bills, info
  lavender: '#D3CDF8',   // category tags
  forest: '#3E6B55',     // secondary quick-reply pill

  // tab bar
  tabIdle: '#6F6D68',
} as const;

// Category → tile colour (glyph is always ink, stroke 2.1)
export const categoryHue: Record<string, string> = {
  food: colors.tomato, groceries: colors.mint, shopping: colors.peri2, fuel: colors.marigold,
  bills: colors.sky, rent: colors.peri, salary: colors.mint, transport: colors.mint,
  education: colors.marigold, other: colors.sky,
};

export const fonts = {
  // expo install @expo-google-fonts/barlow-semi-condensed @expo-google-fonts/jetbrains-mono
  display: 'BarlowSemiCondensed_700Bold',   // titles, card headers — ALWAYS uppercase
  number: 'BarlowSemiCondensed_600SemiBold', // amounts
  numberBold: 'BarlowSemiCondensed_700Bold',
  mono: 'JetBrainsMono_400Regular',          // ALL body copy, labels, chips, inputs
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const type = {
  title:      { fontFamily: fonts.display, fontSize: 32, lineHeight: 29, textTransform: 'uppercase', letterSpacing: 0.2 },
  titleXL:    { fontFamily: fonts.display, fontSize: 36, lineHeight: 32, textTransform: 'uppercase' },
  cardTitle:  { fontFamily: fonts.display, fontSize: 19, lineHeight: 18, textTransform: 'uppercase', letterSpacing: 0.2 },
  rowTitle:   { fontFamily: fonts.display, fontSize: 18, lineHeight: 17, textTransform: 'uppercase' },
  heroAmount: { fontFamily: fonts.number, fontSize: 42, lineHeight: 42 },
  statAmount: { fontFamily: fonts.numberBold, fontSize: 44, lineHeight: 44 },
  entryAmount:{ fontFamily: fonts.numberBold, fontSize: 86, lineHeight: 86 },
  rowAmount:  { fontFamily: fonts.number, fontSize: 21 },
  body:       { fontFamily: fonts.mono, fontSize: 12, lineHeight: 21 },   // 1.75 — room for inline chips
  meta:       { fontFamily: fonts.mono, fontSize: 10.5, lineHeight: 15 },
  label:      { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  chip:       { fontFamily: fonts.monoMedium, fontSize: 11 },
} as const;

export const space = { xxs: 4, xs: 6, sm: 8, md: 10, lg: 12, xl: 14, xxl: 18, screenX: 18, screenTop: 8 } as const;

export const radius = {
  inlineChip: 6, tile: 14, tileLg: 19, field: 17, row: 20, card: 24, cardLg: 26, panel: 28, sheet: 34, pill: 999,
} as const;

export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  dur: { micro: 120, base: 240, enter: 320, celebrate: 700 },
  stagger: 60,
  pressScale: 0.97,
  longPressMs: 350, // centre tab: tap = AI chat, hold = new transaction
} as const;

// Tab bar surfaces — the bar has NO container, border or rule; icons float over a fade of the screen colour.
export const tabSurface = {
  dark:     { fade: 'rgb(36,36,38)',  idle: colors.tabIdle, active: colors.text, dot: colors.tomato, centreBg: colors.cream, centreFg: colors.ink, badge: colors.marigold },
  marigold: { fade: 'rgb(244,196,67)', idle: 'rgba(22,22,22,0.42)', active: colors.ink, dot: colors.ink, centreBg: colors.ink, centreFg: colors.cream, badge: colors.tomato },
} as const;

// Not in design/theme.ts: values the kit reads from design/reference-html (the design's exact CSS).
export const extra = {
  outline: '#8A8880',      // outline CircleButton border on charcoal
  inlineDark: '#1C1C1E',   // `dark` InlineChip fill
  proseOnCard: '#D4D2CA',  // mono prose inside a card
  mutedOnCream: '#6E685C', // secondary text on a cream sheet
  dashedOnCream: '#9C9483',// dashed "New" tile border
  handle: '#C9C1AF',       // sheet handle
  track: '#E4DCCB',        // dial / progress track on cream
  shadow: 'rgba(0,0,0,0.28)',
  coachShadow: 'rgba(0,0,0,0.35)', // the first-run coach mark (Transactions.html)
  scrim: 'rgba(0,0,0,0.45)', // behind an OptionSheet (ours: the design has no dropdown menu)
} as const;
