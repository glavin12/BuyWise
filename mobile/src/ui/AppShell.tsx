import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/lib/network";

import { Text } from "./Text";
import { theme } from "./theme";

/** C1: persistent banner while the device has no connection. Clears itself on reconnect (C2). */
function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;

  return (
    <View accessibilityRole="alert" style={[styles.offline, { paddingTop: insets.top + theme.space.sm }]}>
      <Text variant="caption" tone="onAccent">
        No internet connection
      </Text>
    </View>
  );
}

/** Root frame: app background plus the offline banner above whatever screen is showing. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.shell}>
      <OfflineBanner />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: theme.color.background },
  content: { flex: 1 },
  offline: {
    alignItems: "center",
    paddingBottom: theme.space.sm,
    backgroundColor: theme.color.text,
  },
});
