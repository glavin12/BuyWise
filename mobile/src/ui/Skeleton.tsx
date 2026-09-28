import { useEffect, useState } from "react";
import { Animated, Platform, type DimensionValue } from "react-native";

import { theme } from "./theme";
import { colors, radius as radii } from "./tokens";

// `tone` is what it sits on: the cream screens, charcoal, or a colour card (a translucent white).
const TONE = { cream: theme.color.skeleton, dark: colors.card2, light: "rgba(255,255,255,0.22)" } as const;

/** Pulsing placeholder block shown while the first load is in flight. */
export function Skeleton({
  width = "100%",
  height = 16,
  tone = "cream",
  round,
}: {
  width?: DimensionValue;
  height?: number;
  tone?: keyof typeof TONE;
  /** A card- or pill-shaped placeholder instead of the small default corner. */
  round?: keyof typeof radii;
}) {
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, opacity, borderRadius: round ? radii[round] : theme.radius.sm, backgroundColor: TONE[tone] }}
    />
  );
}
