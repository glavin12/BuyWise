import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useOnline } from "@/lib/network";

import { theme } from "./theme";

const MAX_LENGTH = 4000; // the server's cap per message
const MAX_LINES = 4;

/** Multiline composer. Send is disabled while empty, while `busy` (a reply is on its way) and offline. */
export function ChatInput({
  value,
  onChangeText,
  onSend,
  busy,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  const online = useOnline();
  const inactive = !online || busy || value.trim() === "";

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={MAX_LENGTH}
        placeholder={online ? "Ask about your money, or log an expense" : "You're offline"}
        placeholderTextColor={theme.color.textMuted}
        accessibilityLabel="Message"
      />
      <Pressable
        onPress={onSend}
        disabled={inactive}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: inactive, busy }}
        style={({ pressed }) => [styles.send, pressed && styles.pressed, inactive && styles.inactive]}
      >
        <Ionicons name="arrow-up" size={20} color={theme.color.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.space.sm,
    padding: theme.space.sm,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: MAX_LINES * theme.type.body.lineHeight + 2 * theme.space.sm,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.sm,
    fontSize: theme.type.body.fontSize,
    color: theme.color.text,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75 },
  inactive: { opacity: 0.4 },
});
