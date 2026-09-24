import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/lib/network";

import { Text } from "./Text";
import { theme } from "./theme";

export type ScreenProps = {
  children: ReactNode;
  /** Shows a header row. Tab roots that draw their own header omit it. */
  title?: string;
  /** Shows a back chevron in the header. */
  back?: boolean;
  /** Adds pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** false renders a plain View for screens that manage their own scrolling. */
  scroll?: boolean;
  /** Lifts content above the keyboard (forms). */
  keyboard?: boolean;
  /** Tab screens pass false: the tab bar already handles the bottom inset. */
  insetBottom?: boolean;
};

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function Screen({
  children,
  title,
  back,
  onRefresh,
  refreshing = false,
  scroll = true,
  keyboard = false,
  insetBottom = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const online = useOnline();

  // While offline the OfflineBanner sits above the app and already covers the
  // status-bar area, so the screen must not add the top inset a second time.
  const frame = { paddingTop: online ? insets.top : 0, paddingBottom: insetBottom ? insets.bottom : 0 };

  const header =
    title || back ? (
      <View style={styles.header}>
        {back ? (
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={theme.color.text} />
          </Pressable>
        ) : null}
        {title ? (
          <Text variant="heading" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
    ) : null;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled" // F2: a tap outside the field dismisses the keyboard
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.scrollContent, styles.fill]}>
      <View style={styles.column}>{children}</View>
    </View>
  );

  const screen = (
    <View style={[styles.root, frame]}>
      {header}
      {body}
    </View>
  );

  // F1: on Android with edge-to-edge, "padding" is the behaviour that works.
  return keyboard ? (
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      {screen}
    </KeyboardAvoidingView>
  ) : (
    screen
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1, backgroundColor: theme.color.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    minHeight: theme.minHit,
    paddingHorizontal: theme.space.lg,
  },
  backButton: { marginLeft: -theme.space.xs },
  scrollContent: { flexGrow: 1, alignItems: "center", padding: theme.space.lg },
  column: { flexGrow: 1, width: "100%", maxWidth: theme.maxContentWidth, gap: theme.space.lg },
});
