import { router, useScrollToTop } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Children, isValidElement, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/lib/network";

import { AppearsAt } from "./motion";
import { useTabBarSpace } from "./TabBar";
import { colors, motion, space } from "./tokens";

export type ScreenProps = {
  children: ReactNode;
  /** Adds pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** false renders a plain View for screens that manage their own scrolling. */
  scroll?: boolean;
  /** Lifts content above the keyboard (forms). */
  keyboard?: boolean;
  /** Tab roots: content clears the floating tab bar (and scrolls under its fade) instead of the bottom inset. */
  tabBar?: boolean;
  /** The background (charcoal unless told otherwise). `screen` and `peri` get a light status bar. */
  surface?: "screen" | "sage" | "peri" | "cream";
  /** A floating button (`Fab`) over the content; the content gets room to scroll clear of it. */
  fab?: ReactNode;
  /**
   * Card entrance (DESIGN.md §6.1) for a scrolling screen of a few blocks: each direct child rises and fades in
   * on the screen's first mount, `motion.stagger` after the one above. Not for long lists (every child animates),
   * and modals (`OptionSheet`) go outside the Screen: they draw nothing but would still take a slot.
   */
  enter?: boolean;
};

const SURFACE = { screen: colors.screen, sage: colors.sage, peri: colors.peri, cream: colors.cream } as const;
const FAB_SPACE = 96;
const MAX_WIDTH = 600; // P2: keep content readable on tablets / wide browsers

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
  keyboard = false,
  tabBar = false,
  surface = "screen",
  fab,
  enter = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const barSpace = useTabBarSpace();
  // Scrolling tab roots pad their content instead, so it can pass under the bar's fade.
  const bottom = tabBar ? (scroll ? 0 : barSpace) : insets.bottom;

  // While offline the OfflineBanner sits above the app and already covers the
  // status-bar area, so the screen must not add the top inset a second time.
  const frame = { paddingTop: online ? insets.top : 0, paddingBottom: bottom };

  const body = scroll ? (
    <ScrollBody onRefresh={onRefresh} refreshing={refreshing} bottom={(tabBar ? barSpace : 0) + (fab ? FAB_SPACE : 0)} enter={enter}>
      {children}
    </ScrollBody>
  ) : (
    <View style={[styles.content, styles.fill]}>
      <View style={styles.column}>{children}</View>
    </View>
  );

  const screen = (
    <View style={[styles.root, frame, { backgroundColor: SURFACE[surface] }]}>
      {(surface === "screen" || surface === "peri") && <StatusBar style="light" />}
      {body}
      {fab}
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
  enter,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing: boolean;
  bottom: number;
  enter: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  useScrollToTop(ref); // N7: tapping the tab you're on scrolls it back to the top (a no-op outside the tabs)

  return (
    <ScrollView
      ref={ref}
      contentContainerStyle={[styles.content, bottom > 0 && { paddingBottom: bottom }]}
      keyboardShouldPersistTaps="handled" // F2: a tap outside the field dismisses the keyboard
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.ink]} progressBackgroundColor={colors.cream} /> : undefined
      }
    >
      <View style={styles.column}>{enter ? <Staged>{children}</Staged> : children}</View>
    </ScrollView>
  );
}

const STEPS = 8; // a block further down waits no longer than the eighth
// Built once, outside any component (the layout-animation docs' advice). The design's 16 px rise, not the preset's 25.
const RISE = Array.from({ length: STEPS + 1 }, (_, i) =>
  FadeInDown.duration(motion.dur.enter)
    .delay(i * motion.stagger)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ translateY: 16 }),
);
// Reduce motion (§6.8): a cross-fade, all at once. `Never` keeps it: the default would skip it too.
const FADE = FadeIn.duration(motion.dur.base).reduceMotion(ReduceMotion.Never);

/**
 * Wraps each direct child in its entrance. Only the mount of a child animates, so a refetch, a pull to refresh
 * or a skeleton turning into content (same slot, same key) never replays it. The children there at the start
 * take turns; one that turns up later (a banner, a card that needs the data) just enters at once.
 * ponytail: every direct child gets a wrapper and a layout animation, so this is for a screen of a few blocks.
 * A long list of rows as direct children would want its own block (Budget's `BudgetTable`) or no `enter`.
 */
function Staged({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const blocks = Children.toArray(children);
  const keyOf = (block: ReactNode, i: number) => (isValidElement(block) && block.key != null ? block.key : String(i));
  const [first] = useState(() => ({
    at: Date.now(),
    turns: new Map(blocks.map((block, i): [string, number] => [keyOf(block, i), Math.min(i, STEPS)])),
  }));

  return blocks.map((block, i) => {
    const key = keyOf(block, i);
    const turn = first.turns.get(key) ?? 0;
    return (
      <AppearsAt.Provider key={key} value={first.at + turn * motion.stagger}>
        {/* The gap is the column's: a child that renders a fragment (a few blocks) keeps its spacing. */}
        <Animated.View entering={reduce ? FADE : RISE[turn]} style={styles.block}>
          {block}
        </Animated.View>
      </AppearsAt.Provider>
    );
  });
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1 },
  // 16 below: the space the last block leaves when nothing (tab bar, Fab) asks for more.
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: space.screenX, paddingTop: space.screenTop, paddingBottom: 16 },
  column: { flexGrow: 1, width: "100%", maxWidth: MAX_WIDTH, gap: space.lg },
  block: { gap: space.lg },
});
