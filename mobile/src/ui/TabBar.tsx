import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Illustration } from "./Illustration";
import { PressableScale } from "./PressableScale";
import { colors, extra, motion, radius, tabSurface } from "./tokens";

// The v3 tab bar (DESIGN.md §5): no container, border or rule. Icons float over a fade of
// the screen colour. Centre = AI chat: tap opens Chat, hold (350 ms) opens the QuickAdd sheet.
// Shapes, sizes and the icon paths come from design/reference-html/Dashboard.html.

export type TabSurface = keyof typeof tabSurface;

const ROW = 62; // the centre circle, the tallest thing in the row
const FADE = 128;
const CENTRE_LABEL = "AI buddy. Hold to add a transaction";

/** Keeps the bar clear of the home indicator / Android nav buttons; the design's 20 on a phone without one. */
function rowBottom(insetBottom: number) {
  return Math.max(20, insetBottom);
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/** Bottom space a tab root leaves so its last content clears the bar. 0 while the keyboard is up (the bar hides). */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  return keyboard ? 0 : rowBottom(insets.bottom) + ROW + 14;
}

const fadeAt = (rgb: string, alpha: number) => rgb.replace("rgb(", "rgba(").replace(")", `,${alpha})`);

/** Pass as `<Tabs tabBar>`. `surfaces` gives a route its own bar colours (Budget: `marigold`). */
export function TabBar({ state, descriptors, navigation, surfaces = {} }: BottomTabBarProps & { surfaces?: Partial<Record<string, TabSurface>> }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const focused = state.routes[state.index];
  const surfaceName = surfaces[focused.name] ?? "dark";
  const surface = tabSurface[surfaceName];
  const bottom = rowBottom(insets.bottom);

  if (keyboard) return null; // it would ride up over the chat input

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[fadeAt(surface.fade, 0), fadeAt(surface.fade, 0.92), surface.fade]}
        locations={[0, 0.42, 0.7]}
        style={[styles.fade, { height: FADE + bottom - 20 }, surfaceName === "marigold" && styles.fadeInset]}
      />
      <View style={[styles.row, { bottom }]} pointerEvents="box-none" accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const isFocused = i === state.index;
          const open = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          if (route.name === "chat") return <CentreButton key={route.key} onPress={open} chatOpen={isFocused} surface={surface} />;
          return (
            <PressableScale
              key={route.key}
              onPress={open}
              accessibilityRole="tab"
              accessibilityLabel={descriptors[route.key].options.title ?? route.name}
              accessibilityState={{ selected: isFocused }}
              style={styles.tab}
            >
              <TabIcon name={route.name} color={isFocused ? surface.active : surface.idle} active={isFocused} ring={surface.active} />
              <View style={[styles.dot, { backgroundColor: isFocused ? surface.dot : "transparent" }]} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function TabIcon({ name, color, active, ring }: { name: string; color: string; active: boolean; ring: string }) {
  if (name === "profile") {
    return (
      <View style={[styles.avatarRing, { borderColor: active ? ring : "transparent", opacity: active ? 1 : 0.8 }]}>
        <Illustration name="avatar_user" width={28} />
      </View>
    );
  }
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      {name === "index" && (
        <Path
          d="M3.2 10.6 10.9 3.9a1.7 1.7 0 0 1 2.2 0l7.7 6.7c.4.3.6.8.6 1.3v7.4a2 2 0 0 1-2 2h-3.6v-5.1a1.8 1.8 0 0 0-1.8-1.8h-4a1.8 1.8 0 0 0-1.8 1.8v5.1H4.6a2 2 0 0 1-2-2v-7.4c0-.5.2-1 .6-1.3z"
          fill={color}
        />
      )}
      {name === "transactions" && (
        <>
          <Rect x={3.5} y={11} width={4.6} height={9.5} rx={2.3} fill={color} />
          <Rect x={9.7} y={4} width={4.6} height={16.5} rx={2.3} fill={color} />
          <Rect x={15.9} y={8} width={4.6} height={12.5} rx={2.3} fill={color} />
        </>
      )}
      {name === "budget" && (
        <>
          <Path d="M5.5 5.2 15.8 3a1.6 1.6 0 0 1 1.9 1.6V6H5.5z" fill={color} />
          <Path
            fillRule="evenodd"
            d="M5 6.6h14a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 19 20.6H5a2.5 2.5 0 0 1-2.5-2.5V9.1A2.5 2.5 0 0 1 5 6.6zm11.2 5.3a1.9 1.9 0 1 0 0 3.8h2.9v-3.8z"
            fill={color}
          />
        </>
      )}
    </Svg>
  );
}

const RING_R = ROW / 2 + 4;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function openQuickAdd() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  router.push("/add-transaction");
}

/** The 62 circle: speech bubble + sparkle, `+` badge. Tomato while Chat is open. */
function CentreButton({
  onPress,
  chatOpen,
  surface,
}: {
  onPress: () => void;
  chatOpen: boolean;
  surface: (typeof tabSurface)[TabSurface];
}) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(0); // 0..1 of the hold ring
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_C * (1 - fill.get()) }));
  const bg = chatOpen ? colors.tomato : surface.centreBg;
  const fg = chatOpen ? colors.ink : surface.centreFg;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={openQuickAdd}
      delayLongPress={motion.longPressMs}
      onPressIn={() => {
        if (!reduceMotion) fill.set(withTiming(1, { duration: motion.longPressMs, easing: Easing.linear }));
      }}
      onPressOut={() => fill.set(0)}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={CENTRE_LABEL}
      accessibilityState={{ selected: chatOpen }}
      accessibilityActions={[{ name: "longpress", label: "Add a transaction" }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && openQuickAdd()}
      style={[styles.centre, { backgroundColor: bg }]}
    >
      <Svg pointerEvents="none" width={RING_R * 2 + 4} height={RING_R * 2 + 4} style={styles.ring}>
        <AnimatedCircle
          cx={RING_R + 2}
          cy={RING_R + 2}
          r={RING_R}
          stroke={surface.badge}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={RING_C}
          animatedProps={ringProps}
          rotation={-90}
          origin={`${RING_R + 2}, ${RING_R + 2}`}
        />
      </Svg>
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <Path d="M12 3.2c5 0 8.8 3.3 8.8 7.6S17 18.4 12 18.4c-1 0-2-.1-2.9-.4L5 20.3l.9-3.8C4.2 15 3.2 13 3.2 10.8 3.2 6.5 7 3.2 12 3.2z" fill={fg} />
        <Path d="M12 6.8l1.1 2.8 2.8 1.1-2.8 1.1L12 14.6l-1.1-2.8-2.8-1.1 2.8-1.1z" fill={bg} />
      </Svg>
      <View style={[styles.badge, { backgroundColor: surface.badge, borderColor: surface.fade }]}>
        <Svg width={10} height={10} viewBox="0 0 24 24">
          <Path d="M12 4v16M4 12h16" stroke={colors.ink} strokeWidth={4.6} strokeLinecap="round" />
        </Svg>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  fadeInset: { left: 12, right: 12 }, // matches the Budget front card's width
  row: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tab: { width: 56, height: 58, alignItems: "center", justifyContent: "center", gap: 6 },
  dot: { width: 5, height: 5, borderRadius: radius.pill },
  avatarRing: { borderRadius: radius.pill, borderWidth: 2, padding: 2.5, margin: -4.5 },
  centre: {
    width: ROW,
    height: ROW,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 10px 24px ${extra.shadow}`,
  },
  ring: { position: "absolute", left: -6, top: -6 },
  badge: {
    position: "absolute",
    right: -4,
    top: -4,
    width: 27, // 21 + a 3px ring in the fade colour
    height: 27,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
