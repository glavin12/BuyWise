import type { LucideIcon } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";

import { daysLeft, safeLine, type SafeToSpend } from "@/lib/home";

import { announce } from "./a11y";
import { Chip, InlineChip, type Hue } from "./Chips";
import { DrawnFill, useCountUp } from "./motion";
import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius, type } from "./tokens";

// Title, Panel and IconTile (DESIGN.md §3), plus the Home screen's HeroAmount, Figures, SafeCard, SectionLabel and
// MiniTile and the Activity screen's TxRow and DayHeader.

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
 * The balance figure (`type.heroAmount`) with its fraction smaller and muted: ₹1,24,860.00. Pass the formatted parts, or `to`
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

/**
 * A small uppercase section label with an optional link on the right ("RECENT … see all →"). `light`: on a cream sheet.
 * `linkLabel` is the link's screen-reader name when its words alone are unclear.
 */
export function SectionLabel({
  label,
  link,
  linkLabel,
  onLink,
  light,
}: {
  label: string;
  link?: string;
  linkLabel?: string;
  onLink?: () => void;
  light?: boolean;
}) {
  return (
    <View style={styles.section}>
      <RNText accessibilityRole="header" style={[styles.sectionLabel, light && { color: extra.mutedOnCream }]}>
        {label}
      </RNText>
      {link && onLink && (
        <PressableScale onPress={onLink} accessibilityRole="link" accessibilityLabel={linkLabel} hitSlop={12}>
          <RNText style={styles.sectionLink}>{link}</RNText>
        </PressableScale>
      )}
    </View>
  );
}

const FIGURE = { text: colors.text, mint: colors.mint, tomato: colors.tomato2 } as const; // tomato2: tomato text is hard to read on charcoal

type Figure = { label: string; value: string; /** mint: money in or left; tomato: negative. */ tone?: keyof typeof FIGURE };

/** Figures side by side under a hairline, each a small label over a Barlow number ("IN · OCT ₹50,000 | OUT ₹32,140 | NET +₹17,860"). */
export function Figures({ items }: { items: Figure[] }) {
  return (
    <View style={styles.figures}>
      {items.map((item) => (
        <View key={item.label} style={styles.figure} accessible accessibilityLabel={`${item.label}: ${item.value}`}>
          <RNText style={styles.figureLabel} numberOfLines={1}>
            {item.label}
          </RNText>
          <RNText style={[styles.figureValue, { color: FIGURE[item.tone ?? "text"] }]} numberOfLines={1} adjustsFontSizeToFit>
            {item.value}
          </RNText>
        </View>
      ))}
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

/**
 * Ink progress bar on a colour card (it draws from 0 on mount), with an optional ink tooltip ("79%") above the fill's end
 * and an optional `tick`: a thin ink mark at that % (how much of the month has gone).
 */
export function Meter({ percent, height = 8, tooltip, tick, label }: { percent: number; height?: 8 | 12; tooltip?: string; tick?: number; label: string }) {
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
      {tick !== undefined ? <View style={[styles.tick, { left: `${Math.max(0, Math.min(100, tick))}%` }]} /> : null}
    </View>
  );
}

/**
 * Home's SAFE TO SPEND TODAY card (the UX review, 2026-10-04), drawn from `lib/home` `safeToSpend`: marigold, tomato once
 * the month's budget is spent. The days-left badge, the day's figure (it counts up), a meter of the budget used with a
 * tick at how much of `month` ("Oct") has gone, then a line. With no budget, the line and "Set a budget →". The whole
 * card is one button (to the budget). `money` formats an unsigned amount in minor units.
 */
export function SafeCard({ safe, month, money, onPress }: { safe: SafeToSpend; month: string; money: (minor: number) => string; onPress: () => void }) {
  const line = safeLine(safe, money);
  if (safe.kind === "none") {
    return (
      <PressableScale onPress={onPress} accessibilityLabel={`Safe to spend today. ${line}`} accessibilityHint="Opens your budget" style={[styles.safe, { backgroundColor: colors.marigold }]}>
        <RNText style={styles.safeLabel}>Safe to spend today</RNText>
        <RNText style={styles.safeLine}>{line}</RNText>
        <Chip label="Set a budget →" variant="ink" />
      </PressableScale>
    );
  }
  const perDay = safe.kind === "ok" ? safe.perDay : 0;
  const used = `${safe.usedPercent}% of budget used`;
  const gone = `${safe.monthPercent}% of ${month} gone`;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Safe to spend today: ${money(perDay)}, ${daysLeft(safe.days)}. ${used}, ${gone}. ${line}`}
      accessibilityHint="Opens your budget"
      style={[styles.safe, { backgroundColor: safe.kind === "over" ? colors.tomato : colors.marigold }]}
    >
      <View style={styles.safeHead}>
        <RNText style={styles.safeLabel}>Safe to spend today</RNText>
        <Chip label={daysLeft(safe.days)} variant="ink" />
      </View>
      <SafeFigure to={perDay} money={money} />
      <View style={styles.safeMeter}>
        <Meter percent={safe.usedPercent} tick={safe.monthPercent} label={`${used}, ${gone}`} />
        <View style={styles.safeKey}>
          <RNText style={styles.safeSmall}>{used}</RNText>
          <RNText style={[styles.safeSmall, styles.safeRight]}>{gone}</RNText>
        </View>
      </View>
      <RNText style={styles.safeLine}>{line}</RNText>
    </PressableScale>
  );
}

function SafeFigure({ to, money }: { to: number; money: (minor: number) => string }) {
  const shown = useCountUp(to);
  return (
    <RNText style={styles.safeAmount} numberOfLines={1} adjustsFontSizeToFit>
      {money(Math.round(shown))}
    </RNText>
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
          <RNText style={styles.txMeta} numberOfLines={2}>
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
  hero: { ...type.heroAmount, letterSpacing: -0.3, color: colors.text },
  heroFraction: { fontSize: 26, color: colors.muted },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { ...type.label, color: colors.muted },
  sectionLink: { ...type.meta, color: colors.text },
  figures: { flexDirection: "row", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  figure: { flex: 1, minWidth: 0, gap: 4 },
  figureLabel: { ...type.label, color: colors.muted },
  figureValue: { ...type.rowAmount, lineHeight: 25 },
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
  goalPercent: { ...type.meta, fontFamily: fonts.monoBold, color: colors.ink },
  goalTitle: { color: colors.ink },
  goalAmounts: { ...type.meta, color: colors.ink },
  meter: { borderRadius: radius.pill, backgroundColor: extra.trackOnColour },
  meterTipRoom: { marginTop: 22 },
  meterFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.ink },
  tick: { position: "absolute", top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.ink },
  safe: { gap: 10, padding: 16, borderRadius: radius.cardLg },
  safeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  safeLabel: { ...type.label, flexShrink: 1, color: colors.ink },
  safeAmount: { ...type.heroAmount, color: colors.ink },
  safeMeter: { gap: 6 },
  safeKey: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  safeSmall: { ...type.meta, flexShrink: 1, color: colors.ink },
  safeRight: { textAlign: "right" },
  safeLine: { ...type.meta, color: colors.ink },
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
  dayLabel: { ...type.label, fontFamily: fonts.monoBold, color: colors.text },
  dayNet: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayNetWord: { ...type.meta, color: colors.muted },
});
