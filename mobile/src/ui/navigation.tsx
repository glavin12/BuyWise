import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View, type ColorValue } from "react-native";

import { theme } from "./theme";

// Navigator styling lives here so the route layouts stay free of visual values.

export const stackScreenOptions = {
  headerShown: false, // screens draw their own header via <Screen title back>
  contentStyle: { backgroundColor: theme.color.background },
};

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: theme.color.accent,
  tabBarInactiveTintColor: theme.color.textMuted,
  tabBarAllowFontScaling: false, // P6
  tabBarStyle: { backgroundColor: theme.color.surface, borderTopColor: theme.color.border },
};

export function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

/** The raised centre "Add" button. It opens a modal route instead of switching tabs. */
export function AddTabButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.slot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={32} color={theme.color.onAccent} />
      </Pressable>
    </View>
  );
}

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: "center" },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    marginTop: -theme.space.lg, // raised above the bar
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.accent,
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
  },
  pressed: { opacity: 0.85 },
});
