import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";

import type { BudgetRowState } from "@/lib/budget";

import { Chip, type Hue } from "./Chips";
import { DrawnFill, useCountUp, type Counted } from "./motion";
import { PressableScale } from "./PressableScale";
import { Skeleton } from "./Skeleton";
import { colors, extra, fonts, radius, type } from "./tokens";

// The Budget screen (the owner's list mockup, 2026-09-29, with the rows of the UX review, 2026-10-04): the
// marigold "LEFT TO BUDGET" card, then one card of category rows. A row has one figure, what is left or how much
// it is over, whose colour and word say the state; its bar fills by spending against everything the category had.

const ROW = {
  over: { figure: colors.tomato2, word: colors.tomato2, bar: colors.tomato }, // tomato2: tomato text is hard to read on charcoal
  near: { figure: colors.marigold, word: colors.muted, bar: colors.marigold },
  left: { figure: colors.mint, word: colors.muted, bar: colors.mint },
  done: { figure: colors.muted, word: colors.muted, bar: extra.outline },
} as const;

/**
 * The marigold "LEFT TO BUDGET" card: the amount (a placeholder while it loads), a line under it, an action on the
 * right. The amount is text as it is, or a number to count up to (DESIGN.md §6.4) with the helper that writes it.
 */
export function ReadyCard({ amount, line, action }: { amount: string | Counted | null; line: string; action: ReactNode }) {
  const said = typeof amount === "object" && amount ? amount.format(amount.to) : amount; // screen readers hear the real figure, not the count
  return (
    <View style={styles.ready}>
      <View style={styles.readyText} accessible accessibilityLabel={`Left to budget: ${said ?? "loading"}. ${line}`}>
        <RNText style={styles.readyLabel}>Left to budget</RNText>
        {amount === null ? <Skeleton tone="light" width="60%" height={34} /> : <Figure amount={amount} />}
        <RNText style={styles.readyLine}>{line}</RNText>
      </View>
      <View style={styles.readyActions}>{action}</View>
    </View>
  );
}

function Figure({ amount }: { amount: string | Counted }) {
  const shown = useCountUp(typeof amount === "string" ? 0 : amount.to);
  return (
    <RNText style={styles.readyAmount} numberOfLines={1} adjustsFontSizeToFit>
      {typeof amount === "string" ? amount : amount.format(shown)}
    </RNText>
  );
}

/** "BUDGETS · needs you first" over one card of rows; `loading` shows placeholder rows. */
export function BudgetTable({ children, loading }: { children?: ReactNode; loading?: boolean }) {
  return (
    <View style={styles.table}>
      <View style={styles.head}>
        <RNText accessibilityRole="header" style={styles.headLabel}>
          Budgets
        </RNText>
        <RNText style={styles.headNote}>needs you first</RNText>
      </View>
      <View style={styles.card}>
        {loading
          ? [0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                <View style={styles.top}>
                  <View style={[styles.nameCol, styles.loadingName]}>
                    <Skeleton tone="dark" width="60%" height={14} />
                    <Skeleton tone="dark" width="80%" height={12} />
                  </View>
                  <Skeleton tone="dark" width={64} height={28} />
                </View>
                <Skeleton tone="dark" height={6} round="pill" />
              </View>
            ))
          : children}
      </View>
    </View>
  );
}

/**
 * One category: the dot and name with its line under them, the one figure (left or over) on the right, then a bar of
 * what it spent with a tick at how much of the month has gone (`tick`: this month only). An overspent row also offers
 * "Cover ₹X" (`onCover`), a button of its own beside the row's, so screen readers reach it too.
 */
export function BudgetRow({
  name,
  dot,
  state,
  tick,
  archived,
  first,
  onPress,
  onCover,
}: {
  name: string;
  dot: Hue;
  state: BudgetRowState;
  /** How much of the month has gone, 0-100; null for any other month. */
  tick: number | null;
  archived?: boolean;
  /** No divider above the first row. */
  first?: boolean;
  onPress: () => void;
  /** Shown on an overspent row as "Cover ₹1,200". */
  onCover?: () => void;
}) {
  const look = ROW[state.kind];
  const line = archived ? `${state.line} · archived` : state.line;
  return (
    <View style={[styles.row, !first && styles.divider]}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityLabel={`${name}: ${state.figure} ${state.word}. ${line}`}
        accessibilityHint="Edits this budget"
        style={styles.main}
      >
        <View style={styles.top}>
          <View style={styles.nameCol}>
            <View style={styles.nameRow}>
              <View style={[styles.dot, { backgroundColor: colors[dot] }]} />
              <RNText style={styles.name} numberOfLines={1}>
                {name}
              </RNText>
            </View>
            <RNText style={styles.line}>{line}</RNText>
          </View>
          <View style={styles.figureCol}>
            <RNText style={[styles.figure, { color: look.figure }]} numberOfLines={1} adjustsFontSizeToFit>
              {state.figure}
            </RNText>
            <RNText style={[styles.word, { color: look.word }]}>{state.word}</RNText>
          </View>
        </View>
        <View style={styles.track}>
          <DrawnFill percent={state.barPercent} style={[styles.fill, { backgroundColor: look.bar }]} />
          {tick !== null ? <View style={[styles.tick, { left: `${tick}%` }]} /> : null}
        </View>
      </PressableScale>
      {state.kind === "over" && onCover ? (
        <Chip label={`Cover ${state.figure}`} accessibilityLabel={`Cover the ${state.figure} overspend in ${name}`} onPress={onCover} />
      ) : null}
    </View>
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
  readyLine: { ...type.meta, color: colors.ink },
  readyActions: { alignItems: "flex-end", gap: 8 },
  table: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14 },
  headLabel: { ...type.label, color: colors.muted },
  headNote: { ...type.meta, color: colors.muted },
  card: { borderRadius: radius.cardLg, backgroundColor: colors.card, overflow: "hidden" },
  row: { gap: 10, paddingVertical: 16, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.screen },
  main: { gap: 12 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  nameCol: { flex: 1, minWidth: 0, gap: 4 },
  loadingName: { gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  name: { flexShrink: 1, fontFamily: fonts.monoMedium, fontSize: 15, color: colors.text },
  line: { ...type.meta, color: colors.muted },
  figureCol: { maxWidth: "45%", alignItems: "flex-end" },
  figure: { ...type.rowAmount, lineHeight: 24 },
  word: { ...type.meta },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: extra.inlineDark },
  fill: { height: "100%", borderRadius: radius.pill },
  // How much of the month has gone: a thin cream mark across the track.
  tick: { position: "absolute", top: -3, bottom: -3, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.text },
});
