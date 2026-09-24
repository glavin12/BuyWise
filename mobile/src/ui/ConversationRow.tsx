import { Pressable, StyleSheet } from "react-native";

import type { Conversation } from "@/lib/types";

import { Text } from "./Text";
import { theme } from "./theme";

/** One History row: tap opens the thread, long-press asks to delete it (no long-press while `locked`). */
export function ConversationRow({
  conversation,
  onPress,
  onLongPress,
  locked,
}: {
  conversation: Conversation;
  onPress: (id: string) => void;
  onLongPress: (conversation: Conversation) => void;
  locked: boolean;
}) {
  const when = new Date(conversation.last_message_at ?? conversation.created_at).toLocaleDateString();
  const title = conversation.title || "New conversation";

  return (
    <Pressable
      onPress={() => onPress(conversation.id)}
      onLongPress={locked ? undefined : () => onLongPress(conversation)}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={locked ? "A reply is on its way" : "Long-press to delete"}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text numberOfLines={1}>{title}</Text>
      <Text variant="caption" tone="muted">
        {`${when} · ${conversation.message_count} messages`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.minHit,
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
  },
  pressed: { opacity: 0.75 },
});
