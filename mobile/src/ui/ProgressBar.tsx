import { StyleSheet, View } from "react-native";

import { theme } from "./theme";

const FILL = {
  accent: theme.color.accent,
  positive: theme.color.positive,
  negative: theme.color.negative,
};

/**
 * A horizontal bar for 0-100. Values outside that are clamped, so an over-budget
 * bar can never grow past its track (the true percent belongs in the text next to
 * it). `label` is what a screen reader says.
 */
export function ProgressBar({
  percent,
  label,
  tone = "accent",
}: {
  percent: number;
  label: string;
  tone?: keyof typeof FILL;
}) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: FILL[tone] }]} />
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
