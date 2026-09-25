import { StyleSheet, View } from "react-native";

import { categoryStyle } from "@/lib/categoryStyle";

import { theme } from "./theme";

const FILL = {
  accent: theme.color.accent,
  positive: theme.color.positive,
  negative: theme.color.negative,
  warning: theme.color.warning,
};

/**
 * A horizontal bar for 0-100. Values outside that are clamped, so an over-budget
 * bar can never grow past its track (the true percent belongs in the text next to
 * it). `label` is what a screen reader says. `category` paints the fill in that
 * category's hue; an explicit `tone` (such as negative for over budget) wins.
 */
export function ProgressBar({
  percent,
  label,
  tone,
  category,
}: {
  percent: number;
  label: string;
  tone?: keyof typeof FILL;
  category?: { name: string | null; color?: string | null };
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const fill = tone ? FILL[tone] : category ? categoryStyle(category.name, category.color).bar : FILL.accent;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceMuted,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: theme.radius.pill },
});
