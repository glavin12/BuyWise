import { ArrowUpRight, Plus, type LucideIcon } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/lib/network";

import { PressableScale } from "./PressableScale";
import { colors, extra, fonts, radius } from "./tokens";

// Design v3 buttons (DESIGN.md §3). Sizes come from design/reference-html.

/**
 * The press guard every writing button shares: disabled while offline (C1, when
 * `requiresNetwork`), and busy until an async `onPress` settles so a double tap
 * cannot run it twice.
 */
export function useGuardedPress(
  onPress: () => void | Promise<unknown>,
  { loading = false, disabled = false, requiresNetwork = false }: { loading?: boolean; disabled?: boolean; requiresNetwork?: boolean },
) {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const inactive = disabled || loading || busy || (requiresNetwork && !online);

  const handlePress = async () => {
    // F8/G2: the ref closes the window between two taps in the same frame,
    // before the `busy` state has re-rendered the button as disabled.
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await onPress();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  return { handlePress, inactive, busy: loading || busy };
}

const CIRCLE = {
  cream: { backgroundColor: colors.cream, fg: colors.ink, borderWidth: 0, borderColor: undefined },
  outline: { backgroundColor: "transparent", fg: colors.text, borderWidth: 1.5, borderColor: extra.outline },
  ink: { backgroundColor: colors.ink, fg: colors.cream, borderWidth: 0, borderColor: undefined },
  line: { backgroundColor: colors.cream, fg: colors.ink, borderWidth: 1.5, borderColor: colors.ink }, // on cream / sage
  sage: { backgroundColor: colors.sage2, fg: colors.ink, borderWidth: 0, borderColor: undefined }, // Goals back
} as const;

/** Round icon button: back, ↗, search, bell, edit, history. 40 on a screen, 38 inside a card, 58 beside a PrimaryButton. */
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
  size?: 38 | 40 | 58;
}) {
  const { fg, ...look } = CIRCLE[variant];
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={Math.max(0, (44 - size) / 2 + 2)}
      style={[styles.circle, look, { width: size, height: size }]}
    >
      <Icon size={size > 40 ? 20 : 18} color={fg} strokeWidth={2.3} />
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

/**
 * Transparent outlined pill. `surface` is what it sits on: ink border on cream/colour, `line` on charcoal.
 * `danger` is for a destructive action (Delete, Archive): red text and border (the cream sheet's error red, tomato on charcoal).
 */
export function SecondaryButton({
  label,
  onPress,
  surface = "light",
  danger,
  ...guard
}: GuardedProps & { label: string; surface?: "light" | "dark"; danger?: boolean }) {
  const { handlePress, inactive, busy } = useGuardedPress(onPress, guard);
  const fg = danger ? (surface === "light" ? extra.errorOnCream : colors.tomato) : surface === "light" ? colors.ink : colors.text;
  return (
    <PressableScale
      onPress={handlePress}
      disabled={inactive}
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={[styles.secondary, { borderColor: danger ? fg : surface === "light" ? colors.ink : colors.line }, inactive && styles.inactive]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <RNText style={[styles.secondaryLabel, { color: fg }]}>{label}</RNText>}
    </PressableScale>
  );
}

/** A small ink pill with an icon: Budget's "Copy Aug". */
export function PillButton({ label, icon: Icon, onPress, ...guard }: GuardedProps & { label: string; icon: LucideIcon }) {
  const { handlePress, inactive, busy } = useGuardedPress(onPress, guard);
  return (
    <PressableScale
      onPress={handlePress}
      disabled={inactive}
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={[styles.pill, inactive && styles.inactive]}
    >
      {busy ? <ActivityIndicator color={colors.cream} /> : <Icon size={15} color={colors.cream} strokeWidth={2.3} />}
      <RNText style={styles.pillLabel}>{label}</RNText>
    </PressableScale>
  );
}

/** The floating marigold + at the bottom right of a stack screen (Goals: new goal). Pass it as `<Screen fab>`. */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={[styles.fab, { bottom: insets.bottom + 22 }]}>
      <Plus size={28} color={colors.ink} strokeWidth={2.6} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  pillLabel: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.cream },
  fab: {
    position: "absolute",
    right: 18,
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.marigold,
    alignItems: "center",
    justifyContent: "center",
  },
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
