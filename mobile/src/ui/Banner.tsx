import { CircleAlert, Info, TriangleAlert } from "lucide-react-native";
import { StyleSheet, Text as RNText, View } from "react-native";

import { IconTile } from "./Blocks";
import { colors, radius, type } from "./tokens";

// The icon tile carries the tone; the block carries its own fill, so it reads on charcoal and sage alike.
const TONE = {
  info: { icon: Info, hue: "sky" },
  warning: { icon: TriangleAlert, hue: "marigold" },
  error: { icon: CircleAlert, hue: "tomato" },
} as const;

const LOOK = {
  dark: { fill: colors.card, text: colors.text },
  cream: { fill: colors.creamField, text: colors.ink },
} as const;

/** Inline message: form errors, "session expired", "showing last known data". `surface`: what it sits on (default dark; "cream" on a form sheet). */
export function Banner({ tone, message, surface = "dark" }: { tone: keyof typeof TONE; message: string; surface?: keyof typeof LOOK }) {
  const { icon, hue } = TONE[tone];
  const look = LOOK[surface];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: look.fill }]}>
      <IconTile icon={icon} color={hue} size={30} />
      <RNText style={[styles.message, { color: look.text }]}>{message}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: radius.field,
  },
  message: { flex: 1, ...type.body, lineHeight: 18, paddingVertical: 4 },
});
