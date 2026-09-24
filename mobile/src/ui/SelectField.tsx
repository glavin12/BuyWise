import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "./Text";
import { theme } from "./theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** A labelled field that shows a chosen value and opens a chooser when tapped. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  error,
  icon = "chevron-forward",
}: {
  label: string;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
  icon?: IconName;
}) {
  const shown = value || placeholder;

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        style={({ pressed }) => [styles.field, !!error && styles.fieldError, pressed && styles.pressed]}
      >
        <View style={styles.value}>
          <Text tone={value ? "default" : "muted"} numberOfLines={1}>
            {shown}
          </Text>
        </View>
        <Ionicons name={icon} size={20} color={theme.color.textMuted} />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.xs },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.minHit,
    paddingHorizontal: theme.space.md,
    gap: theme.space.sm,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
  },
  fieldError: { borderColor: theme.color.negative },
  pressed: { opacity: 0.75 },
  value: { flex: 1, minWidth: 0 },
});
