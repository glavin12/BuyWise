import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { motion } from "./tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while held (DESIGN.md §6.2: 0.97). */
  scaleTo?: number;
};

/** Every tappable card and button in the v3 kit: shrinks while held, not at all under reduce motion. */
export function PressableScale({ scaleTo = motion.pressScale, style, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        if (!reduceMotion) scale.set(withTiming(scaleTo, { duration: motion.dur.micro }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: motion.dur.micro }));
        onPressOut?.(e);
      }}
    />
  );
}
