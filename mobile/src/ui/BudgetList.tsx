import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";

import type { BudgetRowState } from "@/lib/budget";

import type { Hue } from "./Chips";
import { PressableScale } from "./PressableScale";
import { Skeleton } from "./Skeleton";
import { colors, extra, fonts, radius, type } from "./tokens";

// The Budget screen (the owner's list mockup, 2026-09-29): the marigold "READY TO ASSIGN" card, then
// one card of category rows under CATEGORY / ASSIGNED / AVAILABLE. A row's colours say its state,
// and its words say it too.

const ROW = {
  left: { pill: colors.mint, pillText: colors.ink, bar: colors.mint, line: colors.muted },
  done: { pill: colors.line, pillText: colors.text, bar: extra.outline, line: colors.muted },
  over: { pill: colors.tomato, pillText: colors.ink, bar: colors.tomato, line: colors.tomato },
} as const;

/** The marigold "READY TO ASSIGN" card: the amount (a placeholder while it loads), a line under it, actions on the right. */
export function ReadyCard({ amount, line, action, secondary }: { amount: string | null; line: string; action: ReactNode; secondary?: ReactNode }) {
  return (
    <View style={styles.ready}>
      <View style={styles.readyText} accessible accessibilityLabel={`Ready to assign: ${amount ?? "loading"}. ${line}`}>
        <RNText style={styles.readyLabel}>Ready to assign</RNText>
        {amount === null ? (
          <Skeleton tone="light" width="60%" height={34} />
        ) : (
          <RNText style={styles.readyAmount} numberOfLines={1} adjustsFontSizeToFit>
            {amount}
          </RNText>
        )}
        <RNText style={styles.readyLine}>{line}</RNText>
      </View>
      <View style={styles.readyActions}>
        {action}
        {secondary}
      </View>
    </View>
  );
}

/** CATEGORY / ASSIGNED / AVAILABLE over one card of rows; `loading` shows placeholder rows. */
export function BudgetTable({ children, loading }: { children?: ReactNode; loading?: boolean }) {
  return (
    <View style={styles.table}>
      <View style={styles.head} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <RNText style={[styles.headLabel, styles.nameCol]}>Category</RNText>
        <RNText style={[styles.headLabel, styles.assignedCol]}>Assigned</RNText>
        <RNText style={[styles.headLabel, styles.availableCol]}>Available</RNText>
      </View>
      <View style={styles.card}>
        {loading
          ? [0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                <View style={[styles.nameCol, styles.loadingName]}>
                  <Skeleton tone="dark" width="70%" height={14} />
                  <Skeleton tone="dark" height={5} round="pill" />
                </View>
                <Skeleton tone="dark" width={84} height={30} round="pill" />
              </View>
            ))
          : children}
      </View>
    </View>
  );
}

/** One budgeted category: dot and name, a bar and a line under it, the amount assigned, and the AVAILABLE pill. */
export function BudgetRow({
  name,
  dot,
  assigned,
  state,
  archived,
  first,
  onPress,
}: {
  name: string;
  dot: Hue;
  assigned: string;
  state: BudgetRowState;
  archived?: boolean;
  /** No divider above the first row. */
  first?: boolean;
  onPress: () => void;
}) {
  const look = ROW[state.kind];
  const line = archived ? `${state.line} · archived` : state.line;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={`${name}: assigned ${assigned}, ${state.available} available, ${line}`}
      accessibilityHint="Edits this budget"
      style={[styles.row, !first && styles.divider]}
    >
      <View style={styles.nameCol}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: colors[dot] }]} />
          <RNText style={styles.name} numberOfLines={1}>
            {name}
          </RNText>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${state.barPercent}%`, backgroundColor: look.bar }]} />
        </View>
        <RNText style={[styles.line, { color: look.line }]} numberOfLines={1}>
          {line}
        </RNText>
      </View>
      <RNText style={[styles.assigned, styles.assignedCol]} numberOfLines={1}>
        {assigned}
      </RNText>
      <View style={styles.availableCol}>
        <View style={[styles.pill, { backgroundColor: look.pill }]}>
          <RNText style={[styles.pillText, { color: look.pillText }]} numberOfLines={1}>
            {state.available}
          </RNText>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  ready: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: radius.cardLg,
    backgroundColor: colors.marigold,
  },
  readyText: { flex: 1, minWidth: 0, gap: 2 },
  readyLabel: { ...type.label, color: colors.ink },
  readyAmount: { fontFamily: fonts.numberBold, fontSize: 38, lineHeight: 40, color: colors.ink },
  readyLine: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  readyActions: { alignItems: "flex-end", gap: 8 },
  table: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 },
  headLabel: { ...type.label, color: colors.muted },
  card: { borderRadius: radius.cardLg, backgroundColor: colors.card, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.screen },
  nameCol: { flex: 1, minWidth: 0 },
  loadingName: { gap: 10 },
  assignedCol: { width: 72, textAlign: "right" },
  availableCol: { width: 84, alignItems: "flex-end" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  name: { flexShrink: 1, fontFamily: fonts.monoMedium, fontSize: 15, color: colors.text },
  track: { height: 5, marginTop: 10, borderRadius: radius.pill, backgroundColor: extra.inlineDark },
  fill: { height: "100%", borderRadius: radius.pill },
  line: { ...type.meta, marginTop: 6 },
  assigned: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  pill: { minHeight: 30, justifyContent: "center", paddingHorizontal: 11, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.numberBold, fontSize: 17 },
});
