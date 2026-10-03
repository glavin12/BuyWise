import type { LucideIcon } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";

import { announce } from "./a11y";
import { Chip, InlineChip, type Hue } from "./Chips";
import { DrawnFill, useCountUp } from "./motion";
import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius, type } from "./tokens";

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
const TILE = { 30: [10, 16], 36: [12, 18], 44: [radius.tile, 20], 46: [radius.tile, 22], 58: [radius.tileLg, 26] } as const;

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

type HeroParts = { whole: string; fraction: string };

/**
 * The 40px balance figure with its fraction smaller and muted: ₹1,24,860.00. Pass the formatted parts, or `to`
 * and a `format` that writes them to have it count up to them (DESIGN.md §6.4).
 */
export function HeroAmount({
  tone = "text",
  ...amount
}: { /** `mint` for money in. */ tone?: "text" | "mint" } & (HeroParts | { to: number; format: (n: number) => HeroParts })) {
  const shown = useCountUp("to" in amount ? amount.to : 0);
  const { whole, fraction } = "to" in amount ? amount.format(shown) : amount;
  const said = "to" in amount ? amount.format(amount.to) : amount; // screen readers hear the real figure, not the count
  return (
    <RNText style={[styles.hero, { color: colors[tone] }]} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={said.whole + said.fraction}>
      {whole}
      <RNText style={styles.heroFraction}>{fraction}</RNText>
    </RNText>
  );
}

/** A small uppercase section label with an optional link on the right ("RECENT … see all →"). `light`: on a cream sheet. */
export function SectionLabel({ label, link, onLink, light }: { label: string; link?: string; onLink?: () => void; light?: boolean }) {
  return (
    <View style={styles.section}>
      <RNText accessibilityRole="header" style={[styles.sectionLabel, light && { color: extra.mutedOnCream }]}>
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

const NOTE = { muted: colors.muted, cream: extra.mutedOnCream, error: extra.errorOnCream } as const;

/** A line of small mono text ("47 transactions found"). `cream` / `error` are for a cream sheet. */
export function Note({ children, tone = "muted" }: { children: string; tone?: keyof typeof NOTE }) {
  useEffect(() => {
    if (tone === "error") announce(children);
  }, [tone, children]);
  return <RNText style={[styles.note, { color: NOTE[tone] }]}>{children}</RNText>;
}

/** Ink progress bar on a colour card (it draws from 0 on mount), with an optional ink tooltip ("79%") above the fill's end. */
export function Meter({ percent, height = 8, tooltip, label }: { percent: number; height?: 8 | 12; tooltip?: string; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}
      style={[styles.meter, { height }, tooltip && styles.meterTipRoom]}
    >
      <DrawnFill percent={p} style={styles.meterFill}>
        {tooltip ? (
          // A 60-wide anchor centred on the fill's end (100% of the fill) centres the tip over it.
          <View style={styles.tipAnchor}>
            <RNText style={styles.tip}>{tooltip}</RNText>
          </View>
        ) : null}
      </DrawnFill>
    </View>
  );
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

/** A goal in the Goals grid: glyph tile, percent, name, "₹40K of ₹1L", an ink meter. Tapping it puts it on the dial. */
export function GoalTile({
  icon,
  color,
  title,
  amounts,
  percent,
  onPress,
}: {
  icon: LucideIcon;
  color: Hue;
  title: string;
  amounts: string;
  percent: number;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${title}. ${amounts}, ${percent}%`}
      accessibilityHint="Shows this goal on the dial"
      style={[styles.goal, { backgroundColor: colors[color] }]}
    >
      <View style={styles.goalTop}>
        <IconTile icon={icon} color="cream" size={36} />
        <RNText style={styles.goalPercent}>{`${percent}%`}</RNText>
      </View>
      <RNText style={[type.rowTitle, styles.goalTitle]} numberOfLines={2}>
        {title}
      </RNText>
      <RNText style={styles.goalAmounts}>{amounts}</RNText>
      <Meter percent={percent} label={`${title} progress`} />
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
  note: { ...type.meta },
  goal: { flex: 1, gap: 10, padding: 14, borderRadius: 22 },
  goalTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalPercent: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.ink },
  goalTitle: { color: colors.ink },
  goalAmounts: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink },
  meter: { borderRadius: radius.pill, backgroundColor: extra.trackOnColour },
  meterTipRoom: { marginTop: 22 },
  meterFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.ink },
  tipAnchor: { position: "absolute", top: -26, left: "100%", width: 60, marginLeft: -30, alignItems: "center" },
  tip: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 18,
    paddingHorizontal: 7,
    borderRadius: 7,
    overflow: "hidden",
    color: colors.cream,
    backgroundColor: colors.ink,
  },
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
