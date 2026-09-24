// Greybox theme: system font, greys, one accent colour.
// Every visual token lives here and ONLY the components in src/ui read it, so
// the real design (Phase 1.5) replaces this file and the primitives without
// touching a single screen.
export const theme = {
  color: {
    background: "#F4F4F5",
    surface: "#FFFFFF",
    surfaceMuted: "#E4E4E7",
    border: "#D4D4D8",
    text: "#18181B",
    textMuted: "#71717A",
    accent: "#2F5BEA",
    onAccent: "#FFFFFF",
    positive: "#15803D",
    negative: "#B91C1C",
    skeleton: "#E4E4E7",
    infoBg: "#E0E7FF",
    warningBg: "#FEF3C7",
    errorBg: "#FEE2E2",
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  type: {
    display: { fontSize: 40, lineHeight: 46, fontWeight: "700" },
    title: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
    heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
    body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  },
  minHit: 44, // minimum touch target
  maxContentWidth: 600, // P2: keep content readable on tablets / wide browsers
} as const;
