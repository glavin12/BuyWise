import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useScrollToTop } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, type ReactNode } from "react";
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

import { useTabBarSpace } from "./TabBar";
import { Text } from "./Text";
import { theme } from "./theme";
import { colors } from "./tokens";

export type ScreenProps = {
  children: ReactNode;
  /** Shows a header row. Tab roots that draw their own header omit it. */
  title?: string;
  /** Shows a back chevron in the header. */
  back?: boolean;
  /** Runs instead of navigating back when the chevron is tapped (e.g. to close an in-screen panel). */
  onBack?: () => void;
  /** Adds pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** false renders a plain View for screens that manage their own scrolling. */
  scroll?: boolean;
  /** Lifts content above the keyboard (forms). */
  keyboard?: boolean;
  /** Tab roots: content clears the floating tab bar (and scrolls under its fade) instead of the bottom inset. */
  tabBar?: boolean;
  /** Design v3 background. Omitted = the old cream background, until every screen has moved over. */
  surface?: "screen" | "sage" | "peri";
};

const SURFACE = { screen: colors.screen, sage: colors.sage, peri: colors.peri } as const;

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function Screen({
  children,
  title,
  back,
  onBack,
  onRefresh,
  refreshing = false,
  scroll = true,
  keyboard = false,
  tabBar = false,
  surface,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const barSpace = useTabBarSpace();
  // Scrolling tab roots pad their content instead, so it can pass under the bar's fade.
  const bottom = tabBar ? (scroll ? 0 : barSpace) : insets.bottom;

  // While offline the OfflineBanner sits above the app and already covers the
  // status-bar area, so the screen must not add the top inset a second time.
  const frame = { paddingTop: online ? insets.top : 0, paddingBottom: bottom };

  const header =
    title || back ? (
      <View style={styles.header}>
        {back ? (
          <Pressable
            onPress={onBack ?? goBack}
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
    <ScrollBody onRefresh={onRefresh} refreshing={refreshing} bottom={tabBar ? barSpace : 0}>
      {children}
    </ScrollBody>
  ) : (
    <View style={[styles.scrollContent, styles.fill]}>
      <View style={styles.column}>{children}</View>
    </View>
  );

  const screen = (
    <View style={[styles.root, frame, surface && { backgroundColor: SURFACE[surface] }]}>
      {surface === "screen" && <StatusBar style="light" />}
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

// Its own component so only scrolling screens use the navigation hook: the root
// ErrorBoundary renders a non-scrolling Screen above the router.
function ScrollBody({
  children,
  onRefresh,
  refreshing,
  bottom,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing: boolean;
  bottom: number;
}) {
  const ref = useRef<ScrollView>(null);
  useScrollToTop(ref); // N7: tapping the tab you're on scrolls it back to the top (a no-op outside the tabs)

  return (
    <ScrollView
      ref={ref}
      contentContainerStyle={[styles.scrollContent, bottom > 0 && { paddingBottom: bottom }]}
      keyboardShouldPersistTaps="handled" // F2: a tap outside the field dismisses the keyboard
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
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
