import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "./Text";
import { theme } from "./theme";

type IconName = keyof typeof Ionicons.glyphMap;

function Step({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={24} color={theme.color.text} />
    </Pressable>
  );
}

/** "‹ August 2026 ›": steps the month back or forward. */
export function MonthSwitcher({
  label,
  onPrevious,
  onNext,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.row}>
      <Step icon="chevron-back" label="Previous month" onPress={onPrevious} />
      <View style={styles.label}>
        <Text variant="heading" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">
          {label}
        </Text>
      </View>
      <Step icon="chevron-forward" label="Next month" onPress={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  label: { flex: 1, minWidth: 0 },
  step: {
    width: theme.minHit,
    height: theme.minHit,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75 },
});
