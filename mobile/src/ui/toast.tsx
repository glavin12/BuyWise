import { useSyncExternalStore } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, extra, fonts, radius, space } from "./tokens";

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

/** A cream pill with a soft shadow, like the first-run coach mark (Transactions.html): cream reads on charcoal, and the shadow keeps it apart on sage and cream. */
export function ToastHost() {
  const text = useSyncExternalStore(subscribe, () => message, () => null);
  const insets = useSafeAreaInsets();
  if (!text) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 88 }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
        <RNText style={styles.text}>{text}</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: space.screenX },
  toast: {
    maxWidth: 420,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.tile,
    backgroundColor: colors.cream,
    boxShadow: `0 8px 20px ${extra.coachShadow}`,
  },
  text: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 18, textAlign: "center", color: colors.ink },
});
