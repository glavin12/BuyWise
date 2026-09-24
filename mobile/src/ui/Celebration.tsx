import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import { theme } from "./theme";

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
      {show ? (
        <View style={styles.overlay} accessibilityViewIsModal>
          <View style={styles.panel} accessibilityLiveRegion="polite">
            <Ionicons name="trophy-outline" size={56} color={theme.color.accent} />
            <Text variant="title" align="center">
              {title}
            </Text>
            <Text tone="muted" align="center">
              {message}
            </Text>
            <Button title="Done" onPress={onDone} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space.xl,
    backgroundColor: theme.color.background,
  },
  panel: {
    width: "100%",
    maxWidth: theme.maxContentWidth,
    alignItems: "stretch",
    gap: theme.space.lg,
  },
});
