import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";

import { Chip, InlineChip, type Hue } from "./Chips";
import { PressableScale } from "./PressableScale";
import { colors, fonts, radius, type } from "./tokens";

// Title, Panel and IconTile (DESIGN.md §3), plus the Home screen's HeroAmount, SectionLabel and MiniTile
// and the Activity screen's TxRow and DayHeader.

/** Condensed uppercase heading. Put "\n" in the text for the two-line titles ("MONEY\nBUDDY"). */
export function Title({
  children,
  size = "title",
  tone = "text",
}: {
  children: string;
  /** `panelTitle` is the 24px heading on a colour card ("SPEND / PULSE"). */
  size?: "title" | "titleXL" | "cardTitle" | "panelTitle";
  /** `ink` on light and colour surfaces. */
  tone?: "text" | "ink";
}) {
  return (
    <RNText accessibilityRole="header" style={[size === "panelTitle" ? styles.panelTitle : type[size], { color: colors[tone] }]}>
      {children}
    </RNText>
  );
}

/** The design's card: a rounded colour block. Tappable when given `onPress`. */
export function Panel({
  children,
  color = "card",
  large,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  color?: Hue;
  /** Radius 26 (the Spend Pulse / envelope front cards) instead of 24. */
  large?: boolean;
  onPress?: () => void;
  /** Screen-reader label when tappable. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const look = [styles.panel, { backgroundColor: colors[color], borderRadius: large ? radius.cardLg : radius.card }, style];
  if (!onPress) return <View style={look}>{children}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={look}>
      {children}
    </PressableScale>
  );
}

// size → [corner radius, glyph size], from design/reference-html.
const TILE = { 30: [10, 16], 44: [radius.tile, 20], 46: [radius.tile, 22], 58: [radius.tileLg, 26] } as const;

/** Rounded colour square with an ink line glyph (categories, recent tiles), or a text glyph like "₹". */
export function IconTile({ icon: Icon, color, size = 44 }: { icon: LucideIcon | string; color: Hue; size?: keyof typeof TILE }) {
  const [corner, glyph] = TILE[size];
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: corner, backgroundColor: colors[color] }]}>
      {typeof Icon === "string" ? (
        <RNText style={[styles.tileGlyph, { fontSize: glyph + 4 }]}>{Icon}</RNText>
      ) : (
        <Icon size={glyph} color={colors.ink} strokeWidth={2.1} />
      )}
    </View>
  );
}

/** The 40px balance figure with its fraction smaller and muted: ₹1,24,860.00. Pass the formatted parts. */
export function HeroAmount({ whole, fraction }: { whole: string; fraction: string }) {
  return (
    <RNText style={styles.hero} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={whole + fraction}>
      {whole}
      <RNText style={styles.heroFraction}>{fraction}</RNText>
    </RNText>
  );
}

/** A small uppercase section label with an optional link on the right ("RECENT … see all →"). */
export function SectionLabel({ label, link, onLink }: { label: string; link?: string; onLink?: () => void }) {
  return (
    <View style={styles.section}>
      <RNText accessibilityRole="header" style={styles.sectionLabel}>
        {label}
      </RNText>
      {link && onLink && (
        <PressableScale onPress={onLink} accessibilityRole="link" hitSlop={12}>
          <RNText style={styles.sectionLink}>{link}</RNText>
        </PressableScale>
      )}
    </View>
  );
}

/** A compact card for one transaction: tile, name, amount (`tone` mint for money in). */
export function MiniTile({
  tile,
  name,
  amount,
  tone = "text",
  onPress,
  label,
}: {
  tile: ReactNode;
  name: string;
  amount: string;
  tone?: "text" | "mint";
  onPress: () => void;
  label: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.mini}>
      {tile}
      <View style={styles.miniText}>
        <RNText style={styles.miniName} numberOfLines={1}>
          {name}
        </RNText>
        <RNText style={[styles.miniAmount, { color: colors[tone] }]} numberOfLines={1}>
          {amount}
        </RNText>
      </View>
    </PressableScale>
  );
}

/** A line of small muted mono text ("47 transactions found"). */
export function Note({ children }: { children: string }) {
  return <RNText style={styles.note}>{children}</RNText>;
}

/** One Activity row: tile, uppercase name, mono meta line, lavender category tag, amount on the right. */
export function TxRow({
  tile,
  title,
  meta,
  tag,
  amount,
  tone = "text",
  onPress,
  label,
}: {
  tile: ReactNode;
  title: string;
  meta: string;
  tag: string | null;
  amount: string;
  tone?: "text" | "mint";
  onPress: () => void;
  label: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.tx}>
      {tile}
      <View style={styles.txText}>
        <RNText style={styles.txTitle} numberOfLines={1}>
          {title}
        </RNText>
        {meta ? (
          <RNText style={styles.txMeta} numberOfLines={1}>
            {meta}
          </RNText>
        ) : null}
        {tag ? (
          <View style={styles.txTag}>
            <Chip label={tag} variant="lavender" />
          </View>
        ) : null}
      </View>
      <RNText style={[type.rowAmount, { color: colors[tone] }]} numberOfLines={1}>
        {amount}
      </RNText>
    </PressableScale>
  );
}

/** A day's header in a list: "TODAY" on the left, "net" and the day's total in an inline chip on the right. */
export function DayHeader({ label, net, kind }: { label: string; net: string; kind: "coral" | "mint" | "dark" }) {
  return (
    <View style={styles.day} accessibilityRole="header" accessible accessibilityLabel={`${label}, net ${net}`}>
      <RNText style={styles.dayLabel}>{label}</RNText>
      <View style={styles.dayNet}>
        <RNText style={styles.dayNetWord}>net</RNText>
        <InlineChip kind={kind} text={net} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 14 },
  panelTitle: { ...type.cardTitle, fontSize: 24, lineHeight: 23 },
  tile: { alignItems: "center", justifyContent: "center" },
  tileGlyph: { fontFamily: fonts.numberBold, color: colors.ink },
  hero: { fontFamily: fonts.number, fontSize: 40, lineHeight: 44, letterSpacing: -0.3, color: colors.text },
  heroFraction: { fontSize: 26, color: colors.muted },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  sectionLink: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.text },
  mini: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  miniText: { flex: 1, minWidth: 0 },
  miniName: { ...type.meta, color: colors.muted },
  miniAmount: { fontFamily: fonts.number, fontSize: 16, lineHeight: 19 },
  note: { ...type.meta, color: colors.muted },
  tx: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.row, backgroundColor: colors.card },
  txText: { flex: 1, minWidth: 0 },
  txTitle: { ...type.rowTitle, color: colors.text },
  txMeta: { ...type.meta, marginTop: 4, color: colors.muted },
  txTag: { marginTop: 6 },
  // Opaque so rows scroll under it while it sticks.
  day: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 6, backgroundColor: colors.screen },
  dayLabel: { fontFamily: fonts.monoBold, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: colors.text },
  dayNet: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayNetWord: { ...type.meta, color: colors.muted },
});
