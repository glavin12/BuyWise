import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "./theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** A decorative icon: the words beside it, or the parent's accessibility label, carry the meaning. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={theme.color.textMuted}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
