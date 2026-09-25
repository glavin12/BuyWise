import { Text as RNText, View } from "react-native";

import { categoryEmoji, categoryStyle } from "@/lib/categoryStyle";

import { theme } from "./theme";

/** A category's emoji on its pastel tile (Day-0 §8 hues). Decorative: the name next to it carries the meaning. */
export function CategoryIcon({
  name,
  icon,
  color,
  size = 36,
}: {
  name: string | null | undefined;
  icon?: string | null;
  color?: string | null;
  size?: number;
}) {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: categoryStyle(name, color).bg,
      }}
    >
      <RNText allowFontScaling={false} style={{ fontSize: size * 0.45 }}>
        {categoryEmoji(name, icon)}
      </RNText>
    </View>
  );
}
