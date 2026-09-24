import { Pressable, StyleSheet, View, type ViewProps } from "react-native";

import { theme } from "./theme";

export type CardProps = Omit<ViewProps, "style"> & {
  /** Makes the whole card tappable. */
  onPress?: () => void;
  /** Fill the remaining space in a Row (equal-width cards). */
  grow?: boolean;
};

export function Card({ onPress, grow, children, ...rest }: CardProps) {
  const style = [styles.card, grow && styles.grow];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [style, pressed && styles.pressed]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.space.lg,
    gap: theme.space.sm,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
  },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
});
