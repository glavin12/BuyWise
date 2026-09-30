import { MessageCircle } from "lucide-react-native";
import { StyleSheet, Text as RNText, View } from "react-native";

import { timeAgo } from "@/lib/format";
import type { Conversation } from "@/lib/types";

import { IconTile } from "./Blocks";
import { Stack } from "./Layout";
import { PressableScale } from "./PressableScale";
import { Skeleton } from "./Skeleton";
import { colors, fonts, radius, type } from "./tokens";

// History in Activity's style: card rows (tile, uppercase title, mono "when · N messages") under
// sticky group labels.

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
  const when = timeAgo(conversation.last_message_at ?? conversation.created_at);
  const title = conversation.title || "New conversation";
  const count = `${conversation.message_count} ${conversation.message_count === 1 ? "message" : "messages"}`;

  return (
    <PressableScale
      onPress={() => onPress(conversation.id)}
      onLongPress={locked ? undefined : () => onLongPress(conversation)}
      accessibilityLabel={`${title}, ${when}, ${count}`}
      accessibilityHint={locked ? "Can't be deleted right now" : "Long-press to delete"}
      style={styles.row}
    >
      <IconTile icon={MessageCircle} color="mint" size={46} />
      <View style={styles.text}>
        <RNText style={styles.title} numberOfLines={1}>
          {title}
        </RNText>
        <RNText style={styles.meta} numberOfLines={1}>
          {`${when} · ${count}`}
        </RNText>
      </View>
    </PressableScale>
  );
}

/** A group's label ("TODAY"): opaque, so rows scroll under it while it sticks. */
export function ConversationHeader({ title }: { title: string }) {
  return (
    <View accessibilityRole="header" style={styles.header}>
      <RNText style={styles.headerLabel}>{title}</RNText>
    </View>
  );
}

/** Placeholder rows while the first load is in flight. */
export function ConversationSkeletons() {
  return (
    <Stack gap="sm">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} tone="dark" height={70} round="row" />
      ))}
    </Stack>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.row, backgroundColor: colors.card },
  text: { flex: 1, minWidth: 0 },
  title: { ...type.rowTitle, color: colors.text },
  meta: { ...type.meta, marginTop: 4, color: colors.muted },
  header: { paddingTop: 6, backgroundColor: colors.screen },
  headerLabel: { fontFamily: fonts.monoBold, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: colors.text },
});
