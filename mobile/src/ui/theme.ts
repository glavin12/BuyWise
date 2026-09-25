// "Colorful cream" design (Day-0 §8, the web's globals.css ported).
// Every visual token lives here and ONLY the components in src/ui read it.
// Font names are the keys `useFonts` registers in src/app/_layout.tsx; the
// splash screen stays up until they load, so nothing renders without them.
const font = {
  sans: "InstrumentSans_400Regular",
  sansMedium: "InstrumentSans_500Medium",
  sansSemiBold: "InstrumentSans_600SemiBold",
  serif: "InstrumentSerif_400Regular",
  mono: "JetBrainsMono_400Regular",
} as const;

export const theme = {
  color: {
    background: "#F4EEE1",
    surface: "#FFFCF4",
    surfaceMuted: "#F0E6D2", // tracks, segmented control, code
    border: "#E4DBC5",
    text: "#1B1B1B",
    textMuted: "#7A6F55",
    accent: "#1B1B1B", // the web's call to action is black
    onAccent: "#FFFCF4",
    positive: "#3E7A5A",
    negative: "#B93D28",
    warning: "#8A6B24",
    skeleton: "#EDE4CE",
    infoBg: "#E7EFF9",
    warningBg: "#FBF1D8",
    errorBg: "#FCE9E5",
  },
  font,
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 18, pill: 999 },
  // Custom fonts carry their weight in the family name: no fontWeight, which Android would fake.
  type: {
    display: { fontFamily: font.serif, fontSize: 44, lineHeight: 50 },
    title: { fontFamily: font.serif, fontSize: 28, lineHeight: 34 },
    heading: { fontFamily: font.sansSemiBold, fontSize: 18, lineHeight: 24 },
    body: { fontFamily: font.sans, fontSize: 14, lineHeight: 20 },
    caption: { fontFamily: font.sansMedium, fontSize: 12, lineHeight: 16 },
  },
  // Amounts are always serif (the web's `.serif`), one size per Text variant.
  amount: {
    display: { fontFamily: font.serif, fontSize: 44, lineHeight: 50 },
    title: { fontFamily: font.serif, fontSize: 28, lineHeight: 34 },
    heading: { fontFamily: font.serif, fontSize: 20, lineHeight: 26 },
    body: { fontFamily: font.serif, fontSize: 18, lineHeight: 24 },
    caption: { fontFamily: font.serif, fontSize: 14, lineHeight: 18 },
  },
  minHit: 44, // minimum touch target
  maxContentWidth: 600, // P2: keep content readable on tablets / wide browsers
} as const;
