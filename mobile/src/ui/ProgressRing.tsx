import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "./Text";
import { theme } from "./theme";

const FILL = {
  accent: theme.color.accent,
  positive: theme.color.positive,
  negative: theme.color.negative,
  warning: theme.color.warning,
};

const SIZE = 96;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A circular ring for 0-100 with the percent centred, for a hero card (see
 * `ProgressBar` for the same 0-100 semantics as a bar). `label` is what a
 * screen reader says; `tone` picks the fill the same way `ProgressBar` does.
 */
export function ProgressRing({ percent, label, tone = "accent" }: { percent: number; label: string; tone?: keyof typeof FILL }) {
  // D7: a goal over its target clamps to a full ring; the exact percent belongs in the text next to it.
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={styles.wrap}
    >
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={theme.color.surfaceMuted} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={FILL[tone]}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          // Start at 12 o'clock. An SVG transform string, since `rotation` + `origin` break on web.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.label}>
        <Text variant="heading">{`${Math.round(clamped)}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  label: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
