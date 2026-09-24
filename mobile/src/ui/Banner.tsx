import { StyleSheet, View } from "react-native";

import { Text } from "./Text";
import { theme } from "./theme";

const BACKGROUND = {
  info: theme.color.infoBg,
  warning: theme.color.warningBg,
  error: theme.color.errorBg,
};

/** Inline message: form errors, "session expired", "showing last known data". */
export function Banner({ tone, message }: { tone: keyof typeof BACKGROUND; message: string }) {
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: BACKGROUND[tone] }]}>
      <Text variant="caption">{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: theme.space.md,
    borderRadius: theme.radius.md,
  },
});
