import { WifiOff } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/lib/network";

import { announce } from "./a11y";
import { ToastHost } from "./toast";
import { colors, fonts } from "./tokens";

/** C1: persistent banner while the device has no connection. Clears itself on reconnect (C2). */
function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!online) announce("No internet connection");
  }, [online]);
  if (online) return null;

  // Tomato is the design's alert colour, and ink text on it is readable under light or dark status icons.
  return (
    <View accessibilityRole="alert" style={[styles.offline, { paddingTop: insets.top + 8 }]}>
      <WifiOff size={14} color={colors.ink} strokeWidth={2.4} />
      <RNText style={styles.offlineText}>No internet connection</RNText>
    </View>
  );
}

/** Root frame: app background plus the offline banner above whatever screen is showing. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.shell}>
      <OfflineBanner />
      <View style={styles.content}>{children}</View>
      <ToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.screen },
  content: { flex: 1 },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingBottom: 8,
    backgroundColor: colors.tomato,
  },
  offlineText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.ink },
});
