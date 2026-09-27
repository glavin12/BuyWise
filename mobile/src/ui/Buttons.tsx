import { ArrowUpRight, type LucideIcon } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text as RNText, View } from "react-native";

import { useGuardedPress } from "./Button";
import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius } from "./tokens";

// Design v3 buttons (DESIGN.md §3). Sizes come from design/reference-html.

const CIRCLE = {
  cream: { backgroundColor: colors.cream, fg: colors.ink, borderWidth: 0, borderColor: undefined },
  outline: { backgroundColor: "transparent", fg: colors.text, borderWidth: 1.5, borderColor: extra.outline },
  ink: { backgroundColor: colors.ink, fg: colors.cream, borderWidth: 0, borderColor: undefined },
} as const;

/** Round icon button: back, ↗, search, bell, edit, history. 40 on a screen, 38 inside a card. */
export function CircleButton({
  icon: Icon,
  label,
  onPress,
  variant = "cream",
  size = 40,
}: {
  icon: LucideIcon;
  /** Read by screen readers; the button has no visible text. */
  label: string;
  onPress: () => void;
  variant?: keyof typeof CIRCLE;
  size?: 38 | 40;
}) {
  const { fg, ...look } = CIRCLE[variant];
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={(44 - size) / 2 + 2}
      style={[styles.circle, look, { width: size, height: size }]}
    >
      <Icon size={18} color={fg} strokeWidth={2.3} />
    </PressableScale>
  );
}

type GuardedProps = {
  /** May be async: the button stays busy until it settles (a double tap cannot run it twice). */
  onPress: () => void | Promise<unknown>;
  loading?: boolean;
  disabled?: boolean;
  /** C1: disable while the device is offline (use for anything that writes). */
  requiresNetwork?: boolean;
};

/** Tomato pill: uppercase label on the left, an ink circle with a cream icon at the right end. */
export function PrimaryButton({
  label,
  icon: Icon = ArrowUpRight,
  onPress,
  ...guard
}: GuardedProps & { label: string; icon?: LucideIcon }) {
  const { handlePress, inactive, busy } = useGuardedPress(onPress, guard);
  return (
    <PressableScale
      onPress={handlePress}
      disabled={inactive}
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={[styles.primary, inactive && styles.inactive]}
    >
      <RNText style={styles.primaryLabel} numberOfLines={1}>
        {label}
      </RNText>
      <View style={styles.primaryKnob}>
        {busy ? <ActivityIndicator color={colors.cream} /> : <Icon size={20} color={colors.cream} strokeWidth={2.6} />}
      </View>
    </PressableScale>
  );
}

/** Transparent outlined pill. `surface` is what it sits on: ink border on cream/colour, `line` on charcoal. */
export function SecondaryButton({
  label,
  onPress,
  surface = "light",
  ...guard
}: GuardedProps & { label: string; surface?: "light" | "dark" }) {
  const { handlePress, inactive, busy } = useGuardedPress(onPress, guard);
  const fg = surface === "light" ? colors.ink : colors.text;
  return (
    <PressableScale
      onPress={handlePress}
      disabled={inactive}
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={[styles.secondary, { borderColor: surface === "light" ? colors.ink : colors.line }, inactive && styles.inactive]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <RNText style={[styles.secondaryLabel, { color: fg }]}>{label}</RNText>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primary: {
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.tomato,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 24,
    paddingRight: 8,
  },
  primaryLabel: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 21,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.ink,
  },
  primaryKnob: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryLabel: { fontFamily: fonts.monoBold, fontSize: 12 },
  inactive: { opacity: 0.5 },
});
