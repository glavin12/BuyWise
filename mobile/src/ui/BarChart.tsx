import { StyleSheet, Text as RNText, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";

import { useDraw } from "./motion";
import { PressableScale } from "./PressableScale";
import { Skeleton } from "./Skeleton";
import { colors, fonts, radius } from "./tokens";

export type BarChartMonth = {
  key: string;
  /** "Apr", under the column. */
  label: string;
  /** 0-100, each already scaled against the tallest value in the whole chart (lib/reports.ts barPercents). */
  incomePercent: number;
  spendPercent: number;
  /** What screen readers hear: the exact numbers, which the columns do not draw. */
  hint: string;
};

const COL_W = 40;
const MAX_H = 156; // the tallest column
const MIN_H = 6; // a month with nothing in it is still a stub you can see and tap
const GAP = 8; // a column to its label
const LABEL_H = 20;
const RING = 4.5; // the chosen month's outline (2.5) and the 2 of air inside it
const TOP = radius.tile; // a column's top corners; its bottom ones are tighter
const BOTTOM = 6;
const LOADING = [104, 124, 112, 144, 132, 152];

/**
 * Income vs spend over several months, the last one chosen (DESIGN.md's `DottedColumns`; values from
 * design/reference-html/Reports.html). A column is as tall as the bigger of that month's income and spend: the
 * light fill is income, the darker fill inside it is spend, so the light part left over is what was saved (a
 * month that spent more than came in is all dark). The chosen month is ringed in ink with `tag` above it.
 * Tapping another column calls `onSelect(index)`. `months` null draws placeholder columns while it loads. The columns
 * rise from the baseline on mount and ease to their new heights when the scale changes (DESIGN.md §6.4).
 */
export function BarChart({ months, tag, onSelect }: { months: readonly BarChartMonth[] | null; tag: string | null; onSelect: (index: number) => void }) {
  if (!months) {
    return (
      <View style={styles.chart}>
        {LOADING.map((h, i) => (
          <Skeleton key={i} tone="light" width={COL_W} height={h} round="tile" />
        ))}
      </View>
    );
  }

  const last = months.length - 1;
  const heights = months.map((m) => Math.max(MIN_H, (Math.max(m.incomePercent, m.spendPercent) * MAX_H) / 100));
  return (
    <View style={styles.chart}>
      {months.map((m, i) => {
        const chosen = i === last;
        const h = heights[i];
        return (
          <PressableScale
            key={m.key}
            onPress={() => {
              if (!chosen) onSelect(i);
            }}
            hitSlop={{ left: 4, right: 4 }}
            accessibilityLabel={chosen && tag ? `${m.hint}, ${tag}` : m.hint}
            accessibilityHint={chosen ? undefined : "Shows this month"}
            accessibilityState={{ selected: chosen }}
            style={styles.col}
          >
            <View style={[styles.ring, chosen && styles.ringOn]}>
              <Column h={h} spend={Math.min(h, (m.spendPercent * MAX_H) / 100)} />
            </View>
            <RNText style={[styles.label, chosen && styles.labelOn]}>{m.label}</RNText>
          </PressableScale>
        );
      })}
      {tag ? (
        // Pinned above every column at the right edge, as the design has it: a short chosen column must not put it over its taller neighbours.
        <RNText style={styles.tag} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {tag}
        </RNText>
      ) : null}
    </View>
  );
}

/** One column's body, `h` tall with `spend` of it in the darker fill. */
function Column({ h, spend }: { h: number; spend: number }) {
  const barH = useDraw(h);
  const spendH = useDraw(spend);
  const bar = useAnimatedStyle(() => ({ height: barH.get() }));
  const fill = useAnimatedStyle(() => ({ height: spendH.get() }));
  return (
    <Animated.View style={[styles.bar, bar]}>
      <Animated.View style={[styles.spend, fill]} />
      {h > 24 ? (
        // Full height whatever the column has grown to: the column clips it, so the dots ride up with its top.
        <Svg width={COL_W} height={h} style={StyleSheet.absoluteFill}>
          <Line
            x1={COL_W / 2}
            y1={8}
            x2={COL_W / 2}
            y2={h - 6}
            stroke={colors.ink}
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="0.1 4"
          />
        </Svg>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: MAX_H + GAP + LABEL_H,
    paddingHorizontal: 10,
  },
  col: { width: COL_W, alignItems: "center", gap: GAP },
  // The outline is a border around the column, pulled back out of the layout so a ring does not move its neighbours.
  ring: {
    margin: -RING,
    padding: 2,
    borderWidth: 2.5,
    borderColor: "transparent",
    borderTopLeftRadius: TOP + RING,
    borderTopRightRadius: TOP + RING,
    borderBottomLeftRadius: BOTTOM + RING,
    borderBottomRightRadius: BOTTOM + RING,
  },
  ringOn: { borderColor: colors.ink },
  bar: {
    width: COL_W,
    borderTopLeftRadius: TOP,
    borderTopRightRadius: TOP,
    borderBottomLeftRadius: BOTTOM,
    borderBottomRightRadius: BOTTOM,
    backgroundColor: colors.mint,
    overflow: "hidden",
  },
  spend: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.mint2 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    lineHeight: 16,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
    color: colors.ink,
  },
  labelOn: { color: colors.cream, backgroundColor: colors.ink },
  tag: {
    position: "absolute",
    right: 0,
    top: -38,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    overflow: "hidden",
    color: colors.cream,
    backgroundColor: colors.ink,
  },
});
