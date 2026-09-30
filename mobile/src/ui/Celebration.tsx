import { Check } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text as RNText, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "./Buttons";
import { Illustration } from "./Illustration";
import { colors, motion, type } from "./tokens";

// Goal completion (DESIGN.md §6 item 7): the coin buddy pops in on a mint panel while confetti falls.
// Under reduce motion (item 8) the panel only cross-fades in: no pop, no confetti.

const FALL_MS = 2800;
const CONFETTI = [colors.tomato, colors.marigold, colors.peri, colors.sky, colors.lavender, colors.cream, colors.ink] as const;

// Fixed, not random: the same burst every time, and no random numbers while rendering.
const PIECES = Array.from({ length: 30 }, (_, i) => ({
  left: (i * 37 + 9) % 100, // % across the panel
  delay: ((i * 17) % 10) / 20, // when it lets go, as a fraction of the fall (0 to 0.45)
  width: 7 + (i % 3) * 2,
  height: 10 + (i % 4) * 2,
  turns: 1 + (i % 3),
  drift: (i % 2 ? 1 : -1) * (12 + (i % 5) * 6),
  color: CONFETTI[i % CONFETTI.length],
  round: i % 4 === 0,
}));

/**
 * Wraps a screen. While `show` is set, a "goal reached" panel covers it until
 * Done. Only the code that saw the goal's status change to completed sets `show`.
 */
export function Celebration({
  show,
  title,
  message,
  onDone,
  children,
}: {
  show: boolean;
  title: string;
  message: string;
  onDone: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        importantForAccessibility={show ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={show}
      >
        {children}
      </View>
      {show ? <CelebrationPanel title={title} message={message} onDone={onDone} /> : null}
    </View>
  );
}

function CelebrationPanel({ title, message, onDone }: { title: string; message: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const fade = useSharedValue(0);
  const pop = useSharedValue(reduceMotion ? 1 : 0.4);
  const fall = useSharedValue(0);

  useEffect(() => {
    // The cross-fade plays even under reduce motion: it is the one motion that stays.
    fade.set(withTiming(1, { duration: motion.dur.base, reduceMotion: ReduceMotion.Never }));
    if (reduceMotion) return;
    pop.set(withSpring(1, motion.spring));
    fall.set(withTiming(1, { duration: FALL_MS, easing: Easing.linear }));
  }, [fade, pop, fall, reduceMotion]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Animated.View style={[styles.overlay, { paddingBottom: insets.bottom + 22 }, fadeStyle]} accessibilityViewIsModal>
      {reduceMotion ? null : (
        <View pointerEvents="none" style={styles.confetti} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {PIECES.map((spec, i) => (
            <Piece key={i} spec={spec} fall={fall} distance={height + 48} />
          ))}
        </View>
      )}
      <View style={styles.content} accessibilityLiveRegion="polite">
        <Animated.View style={popStyle}>
          <Illustration name="goal_badge" width={200} />
        </Animated.View>
        <RNText accessibilityRole="header" style={styles.title}>
          {title}
        </RNText>
        <RNText style={styles.message}>{message}</RNText>
      </View>
      <PrimaryButton label="Done" icon={Check} onPress={onDone} />
    </Animated.View>
  );
}

/** One piece of confetti: it lets go after its delay, sways as it drops and spins. */
function Piece({ spec, fall, distance }: { spec: (typeof PIECES)[number]; fall: SharedValue<number>; distance: number }) {
  const moving = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (fall.get() - spec.delay) / (1 - spec.delay)));
    return {
      opacity: t > 0 ? 1 : 0,
      transform: [{ translateY: t * distance }, { translateX: Math.sin(t * Math.PI * 4) * spec.drift }, { rotate: `${t * 360 * spec.turns}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { left: `${spec.left}%`, width: spec.width, height: spec.height, borderRadius: spec.round ? spec.width / 2 : 2, backgroundColor: spec.color },
        moving,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, paddingTop: 34, paddingHorizontal: 18, backgroundColor: colors.mint },
  confetti: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  piece: { position: "absolute", top: -24, opacity: 0 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  title: { ...type.titleXL, textAlign: "center", color: colors.ink },
  message: { ...type.body, maxWidth: 300, textAlign: "center", color: colors.ink },
});
