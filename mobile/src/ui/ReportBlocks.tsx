import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";

import type { Trend } from "@/lib/reports";

import type { Hue } from "./Chips";
import { Illustration } from "./Illustration";
import { DrawnFill } from "./motion";
import { Skeleton } from "./Skeleton";
import { colors, extra, fonts, radius, type } from "./tokens";

// The Reports screen's blocks (design/screens/08-reports.png, values from design/reference-html/Reports.html):
// the tomato panel with its stat cards and chart heading, the mint savings card, the charcoal cards for
// the category breakdown and the payment bars, and the three comparison tiles. The columns themselves are BarChart.
// The segment bar and the payment bars draw from 0 on mount (DESIGN.md §6.4).

// ── The tomato panel ────────────────────────────────────────────

/** The tomato block that holds the two stat cards and the income-vs-spend columns. */
export function TomatoPanel({ children }: { children: ReactNode }) {
  return <View style={styles.tomato}>{children}</View>;
}

/**
 * A lighter card in the tomato panel: an uppercase title with a cream % badge, the amount (`null` while it
 * loads), and optionally a small note at the right ("vs. last month"). No `badge` shows none.
 */
export function StatCard({ title, value, badge, aside }: { title: string; value: string | null; badge?: string | null; aside?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${title}: ${value ?? "loading"}${badge ? `, ${badge} against last month` : ""}`}>
      <View style={styles.statHead}>
        <RNText style={styles.statTitle}>{title}</RNText>
        {badge ? (
          <View style={styles.badge}>
            <RNText style={styles.badgeText} numberOfLines={1}>
              {badge}
            </RNText>
          </View>
        ) : null}
      </View>
      <View style={styles.statBody}>
        {value === null ? (
          <Skeleton tone="light" width="65%" height={40} />
        ) : (
          <RNText style={styles.statAmount} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </RNText>
        )}
        {aside ? <RNText style={styles.statAside}>{aside}</RNText> : null}
      </View>
    </View>
  );
}

function Key({ label, color }: { label: string; color: Hue }) {
  return (
    <View style={styles.key}>
      <View style={[styles.swatch, { backgroundColor: colors[color] }]} />
      <RNText style={styles.keyLabel}>{label}</RNText>
    </View>
  );
}

/** "INCOME VS SPEND" with its in / out key, then room for the columns (BarChart, or a note in their place). */
export function ChartBlock({ children }: { children: ReactNode }) {
  return (
    <View style={styles.chartBlock}>
      <View style={styles.chartHead}>
        <RNText accessibilityRole="header" style={styles.chartTitle}>
          Income vs spend
        </RNText>
        <View style={styles.keys} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Key label="in" color="mint" />
          <Key label="out" color="mint2" />
        </View>
      </View>
      <View style={styles.chartBody}>{children}</View>
    </View>
  );
}

/** Text in the chart's place (it could not load), lined up with the heading above. */
export function ChartNote({ children }: { children: ReactNode }) {
  return <View style={styles.chartNote}>{children}</View>;
}

// ── The savings card ────────────────────────────────────────────

/** The mint card: "SAVINGS RATE" over a two-line sentence (`null` while it loads), the cheering coin buddy at the right. */
export function SavingsCard({ title }: { title: string | null }) {
  return (
    <View style={styles.savings} accessible accessibilityLabel={`Savings rate. ${title ? title.replace("\n", " ") : "Loading"}`}>
      <View style={styles.savingsText}>
        <RNText style={styles.savingsLabel}>Savings rate</RNText>
        {title === null ? (
          <View style={styles.savingsWait}>
            <Skeleton tone="ink" width="75%" height={24} />
            <Skeleton tone="ink" width="55%" height={24} />
          </View>
        ) : (
          <RNText style={styles.savingsTitle}>{title}</RNText>
        )}
      </View>
      <View style={styles.savingsArt} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Illustration name="goal_badge" width={128} />
      </View>
    </View>
  );
}

// ── Charcoal cards ──────────────────────────────────────────────

/** A charcoal card under an uppercase heading, with a small muted note at the right ("Sep 2026", "by amount"). */
export function ReportCard({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <RNText accessibilityRole="header" style={styles.cardTitle}>
          {title}
        </RNText>
        {aside ? <RNText style={styles.cardAside}>{aside}</RNText> : null}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

/** The month as one bar cut into coloured parts; `weight` is each part's share (any scale). A picture only: the rows carry the words. */
export function SegmentBar({ parts }: { parts: { key: string; tone: Hue; weight: number }[] }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* It grows from the left, the parts sharing what width there is. */}
      <DrawnFill percent={100} style={styles.segments}>
        {parts.map((p) => (
          <View key={p.key} style={{ flex: p.weight, backgroundColor: colors[p.tone] }} />
        ))}
      </DrawnFill>
    </View>
  );
}

/** One category: colour dot, name and "· 14 txns", the amount and its %. `first` has no line above it. */
export function CategoryRow({
  name,
  tone,
  count,
  amount,
  percent,
  first,
}: {
  name: string;
  tone: Hue;
  count: string;
  amount: string;
  percent: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.row, first ? styles.rowFirst : styles.rowLine]} accessible accessibilityLabel={`${name}, ${count}, ${amount}, ${percent}`}>
      <View style={[styles.dot, { backgroundColor: colors[tone] }]} />
      <RNText style={styles.name}>
        {name}
        {" "}
        <RNText style={styles.count}>{`· ${count}`}</RNText>
      </RNText>
      <RNText style={styles.amount} numberOfLines={1}>
        {amount}
      </RNText>
      <RNText style={styles.percent}>{percent}</RNText>
    </View>
  );
}

const TREND = { good: colors.mint, bad: colors.tomato, flat: colors.text } as const;

/** One of the three comparison tiles: a small label over a big figure, in mint when the move is good news, tomato when not. */
export function StatTile({ label, value, tone }: { label: string; value: string; tone: Trend }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} against last month: ${value}`}>
      <RNText style={styles.tileLabel}>{label}</RNText>
      <RNText style={[styles.tileValue, { color: TREND[tone] }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </RNText>
    </View>
  );
}

/** One payment method: its name, a bar filled to `percent` in `tone`, and the percent. */
export function MethodBar({ label, tone, percent }: { label: string; tone: Hue; percent: number }) {
  const whole = Math.round(percent);
  return (
    <View style={styles.method} accessible accessibilityLabel={`${label}: ${whole}% of spending`}>
      <RNText style={styles.methodLabel}>{label}</RNText>
      <View style={styles.methodTrack}>
        {/* A sliver still shows for a method that is under 3%. */}
        <DrawnFill percent={Math.max(percent, 3)} style={[styles.methodFill, { backgroundColor: colors[tone] }]} />
      </View>
      <RNText style={styles.methodPercent}>{`${whole}%`}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  tomato: { gap: 8, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 16, borderRadius: radius.panel, backgroundColor: colors.tomato },
  stat: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: extra.lineOnTomato,
    backgroundColor: colors.tomato2,
  },
  statHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 23 },
  statTitle: { ...type.cardTitle, fontSize: 17, lineHeight: 16, color: colors.ink },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.4,
    borderColor: colors.ink,
    backgroundColor: colors.cream,
  },
  badgeText: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: colors.ink },
  statBody: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, minHeight: 44, marginTop: 10 },
  statAmount: { flexShrink: 1, ...type.statAmount, color: colors.ink },
  statAside: { fontFamily: fonts.mono, fontSize: 10.5, lineHeight: 14, textAlign: "right", color: colors.ink },
  chartBlock: { marginTop: 10 },
  chartHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  chartTitle: { ...type.cardTitle, fontSize: 16, lineHeight: 15, color: colors.ink },
  keys: { flexDirection: "row", gap: 10 },
  key: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 3, borderWidth: 1, borderColor: colors.ink },
  keyLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink },
  chartBody: { marginTop: 44 },
  chartNote: { paddingHorizontal: 8 },
  savings: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 124,
    padding: 16,
    borderRadius: radius.cardLg,
    backgroundColor: colors.mint,
    overflow: "hidden",
  },
  savingsText: { flex: 1, minWidth: 0, paddingRight: 90 },
  savingsLabel: { ...type.label, color: colors.ink },
  savingsTitle: { ...type.title, fontSize: 30, lineHeight: 27, marginTop: 2, color: colors.ink },
  savingsWait: { gap: 6, marginTop: 6 },
  savingsArt: { position: "absolute", right: -6, bottom: -14 },
  card: { padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.card },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { ...type.cardTitle, fontSize: 20, lineHeight: 19, color: colors.text },
  cardAside: { ...type.meta, color: colors.muted },
  cardBody: { marginTop: 14 },
  segments: { flexDirection: "row", gap: 3, height: 18, borderRadius: radius.pill, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  rowFirst: { marginTop: 8 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  name: { flex: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  count: { fontSize: 10.5, color: colors.muted },
  amount: { fontFamily: fonts.number, fontSize: 17, color: colors.text },
  percent: { width: 38, textAlign: "right", fontFamily: fonts.mono, fontSize: 10.5, color: colors.muted },
  tile: { flex: 1, minWidth: 0, padding: 12, borderRadius: radius.row, backgroundColor: colors.card },
  tileLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  tileValue: { marginTop: 4, fontFamily: fonts.numberBold, fontSize: 22, lineHeight: 26 },
  method: { flexDirection: "row", alignItems: "center", gap: 10 },
  methodLabel: { width: 48, fontFamily: fonts.mono, fontSize: 11, color: colors.text },
  methodTrack: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: extra.trackOnCard },
  methodFill: { height: "100%", borderRadius: radius.pill },
  methodPercent: { width: 34, textAlign: "right", fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
