import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "./Text";
import { theme } from "./theme";

/** Wrapping pill choices where the value is optional: tapping the selected one clears it. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <View style={styles.chipsWrap}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(selected ? null : option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={option.label}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text variant="caption" tone={selected ? "onAccent" : "default"}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Small pill switcher for a handful of mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text variant="caption" tone={selected ? "default" : "muted"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: theme.space.xs,
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radius.md,
  },
  segment: {
    flex: 1,
    minHeight: theme.minHit, // M25: a comfortable touch target
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  segmentSelected: { backgroundColor: theme.color.surface },
  chipsWrap: { gap: theme.space.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  chip: {
    minHeight: theme.minHit,
    paddingHorizontal: theme.space.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
  },
  chipSelected: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
});
