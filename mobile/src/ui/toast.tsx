import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { theme } from "./theme";

// One message at a time. Any screen calls showToast(); <ToastHost /> in the app
// shell shows it above whatever is on screen, then clears it.
const SHOW_MS = 2500;
let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function publish(next: string | null) {
  message = next;
  listeners.forEach((listener) => listener());
}

export function showToast(text: string) {
  clearTimeout(timer);
  publish(text);
  timer = setTimeout(() => publish(null), SHOW_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ToastHost() {
  const text = useSyncExternalStore(subscribe, () => message, () => null);
  const insets = useSafeAreaInsets();
  if (!text) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 88 }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
        <Text tone="onAccent" align="center">
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: theme.space.lg },
  toast: {
    maxWidth: theme.maxContentWidth,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.text,
  },
});
