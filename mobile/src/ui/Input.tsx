import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type Ref } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { Text } from "./Text";
import { theme } from "./theme";

export type InputProps = Omit<TextInputProps, "style"> & {
  label: string;
  error?: string | null;
  ref?: Ref<TextInput>;
};

/** Labelled text field. `secureTextEntry` adds a show/hide toggle. */
export function Input({ label, error, secureTextEntry, ref, ...rest }: InputProps) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View style={[styles.field, !!error && styles.fieldError]}>
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={theme.color.textMuted}
          accessibilityLabel={label}
          secureTextEntry={secureTextEntry && hidden}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={theme.color.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.xs },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.minHit,
    paddingHorizontal: theme.space.md,
    gap: theme.space.sm,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
  },
  fieldError: { borderColor: theme.color.negative },
  input: { flex: 1, paddingVertical: theme.space.sm, fontSize: theme.type.body.fontSize, color: theme.color.text },
});
