import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { useOnline } from "@/lib/network";

import { Text, type TextTone } from "./Text";
import { theme } from "./theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";

export type ButtonProps = {
  title: string;
  /** May be async: the button stays disabled with a spinner until it settles. */
  onPress: () => void | Promise<unknown>;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** C1: disable while the device is offline (use for anything that writes). */
  requiresNetwork?: boolean;
};

const LABEL_TONE: Record<Variant, TextTone> = {
  primary: "onAccent",
  secondary: "default",
  ghost: "default",
  danger: "onAccent",
  link: "accent",
};

const BACKGROUND: Record<Variant, string> = {
  primary: theme.color.accent,
  secondary: theme.color.surface,
  ghost: "transparent",
  danger: theme.color.negative,
  link: "transparent",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  requiresNetwork = false,
}: ButtonProps) {
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

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading || busy }}
      style={({ pressed }) => [
        styles.base,
        variant === "link" && styles.link,
        variant === "secondary" && styles.bordered,
        { backgroundColor: BACKGROUND[variant] },
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading || busy ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? theme.color.onAccent : theme.color.textMuted}
        />
      ) : (
        <Text variant="heading" tone={LABEL_TONE[variant]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.minHit,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { alignSelf: "flex-start", paddingHorizontal: 0 },
  bordered: { borderWidth: 1, borderColor: theme.color.border },
  pressed: { opacity: 0.75 },
  inactive: { opacity: 0.5 },
});
