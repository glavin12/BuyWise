import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Row } from "./Layout";
import { Text } from "./Text";
import { theme } from "./theme";

/** A sticky group heading (a day) with an optional figure on the right. Opaque, so rows scroll under it cleanly. */
export function SectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View accessibilityRole="header" style={styles.header}>
      <Row justify="between">
        <Text variant="caption" tone="muted">
          {title}
        </Text>
        {children}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: theme.color.background, paddingVertical: theme.space.sm },
});
