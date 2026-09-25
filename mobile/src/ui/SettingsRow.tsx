import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { Text } from "./Text";
import { theme } from "./theme";

/**
 * One Settings row: a label, an optional trailing value, and either a chevron
 * (tap to navigate) or a themed Switch. Exactly one of `onPress` / `onSwitchChange`
 * is expected; passing `onSwitchChange` renders the Switch instead of a chevron.
 */
export function SettingsRow({
  label,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  disabled = false,
}: {
  label: string;
  /** Shown muted, before the chevron (e.g. the saved name or a count). */
  value?: string | null;
  /** Makes the row tappable and shows a chevron. Ignored when `onSwitchChange` is set. */
  onPress?: () => void;
  /** Current Switch state; its presence is what selects the Switch over a chevron. */
  switchValue?: boolean;
  onSwitchChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  const hasSwitch = onSwitchChange !== undefined;

  const row = (
    <View style={styles.row}>
      <View style={styles.label}>
        <Text tone={disabled && !hasSwitch ? "muted" : "default"}>{label}</Text>
      </View>
      {value ? (
        <Text tone="muted" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {hasSwitch ? (
        <Switch
          value={!!switchValue}
          onValueChange={onSwitchChange}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityState={{ checked: !!switchValue, disabled }}
          trackColor={{ false: theme.color.border, true: theme.color.accent }}
          thumbColor={theme.color.surface}
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={20} color={theme.color.textMuted} />
      ) : null}
    </View>
  );

  // The Switch itself is the interactive control (its own accessibility role);
  // wrapping the row in another Pressable would double up the touch target.
  if (hasSwitch || !onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {row}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.minHit,
    gap: theme.space.sm,
  },
  label: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
});
