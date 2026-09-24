import { useEffect, useState } from "react";
import { Animated, Platform, type DimensionValue } from "react-native";

import { theme } from "./theme";

/** Pulsing placeholder block shown while the first load is in flight. */
export function Skeleton({ width = "100%", height = 16 }: { width?: DimensionValue; height?: number }) {
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
      style={{ width, height, opacity, borderRadius: theme.radius.sm, backgroundColor: theme.color.skeleton }}
    />
  );
}
