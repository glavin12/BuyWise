import { useEffect, useState } from "react";
import { Animated, Platform, type DimensionValue } from "react-native";

import { colors, extra, radius as radii } from "./tokens";

// `tone` is what it sits on: a sage screen (Goals, the default), charcoal, a colour card (a translucent white), a cream
// form sheet, or `ink` for a pale colour card (mint) where white would vanish.
const TONE = { sage: colors.sage2, dark: colors.card2, light: "rgba(255,255,255,0.22)", sheet: colors.creamField, ink: extra.trackOnColour } as const;

const CORNER = 8; // the small default corner (the design's radii have no 8)

/** Pulsing placeholder block shown while the first load is in flight. */
export function Skeleton({
  width = "100%",
  height = 16,
  tone = "sage",
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
      style={{ width, height, opacity, borderRadius: round ? radii[round] : CORNER, backgroundColor: TONE[tone] }}
    />
  );
}
