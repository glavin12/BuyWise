import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { isNotFound, userMessage } from "@/lib/api";
import { newIdempotencyKey, prettyToolName, visibleMessages } from "@/lib/chat";
import { usePendingChatIds, useSendMessage, type SendVars } from "@/lib/mutations";
import { useOnline } from "@/lib/network";
import { messagesQuery } from "@/lib/queries";
import type { ChatResponse, Message, ToolCall } from "@/lib/types";

import { Banner } from "./Banner";
import { Button } from "./Button";
import { ChatInput } from "./ChatInput";
import { Row } from "./Layout";
import { Markdown } from "./Markdown";
import { Screen } from "./Screen";
import { Skeleton } from "./Skeleton";
import { EmptyState, ErrorState, NotFoundScreen } from "./States";
import { Text } from "./Text";
import { theme } from "./theme";

const SUGGESTIONS = [
  "What's my current balance?",
  "Show my recent transactions",
  "How much did I spend on Food this month?",
  "How are my goals tracking?",
];

/**
 * A chat thread: the new chat on the Chat tab (no id until the first reply) or
 * an existing conversation. Tool cards and "Thinking" show only on the reply
 * that just arrived: history does not store them.
 */
export function ChatThread({
  conversationId,
  title,
  back = false,
  actions,
}: {
  conversationId?: string;
  title: string;
  /** A stack screen (back chevron, bottom inset); the tab root passes false. */
  back?: boolean;
  actions?: ReactNode;
}) {
  const [startedId, setStartedId] = useState<string>();
  const id = conversationId ?? startedId;
  const history = useQuery({ ...messagesQuery(id ?? ""), enabled: !!id });
  const send = useSendMessage();
  const pendingElsewhere = usePendingChatIds().includes(id ?? ""); // sent from this thread before the user left and came back
  const online = useOnline();
  const [draft, setDraft] = useState("");
  const list = useRef<FlatList<Message>>(null);

  if (id && isNotFound(history.error)) return <NotFoundScreen title={title} what="Conversation" />;

  const busy = send.isPending || pendingElsewhere;
  const vars = send.variables;
  const rows = visibleMessages(history.data?.messages ?? []);
  // A new chat has no cache until its first reply, so that message is drawn here meanwhile.
  const unsent = vars && !vars.conversationId && !send.isSuccess ? vars.message : null;
  const last = rows[rows.length - 1];
  const liveId = send.isSuccess && last?.role === "assistant" ? last.id : undefined;

  // The same key on retry: the server replays a finished send and reruns a failed one.
  const run = (next: SendVars) => send.mutate(next, { onSuccess: (response) => setStartedId(response.conversation_id) });

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || busy || !online) return false;
    run({ message, conversationId: id, idempotencyKey: newIdempotencyKey() });
    return true;
  };

  const empty =
    id && history.isPending ? (
      <View style={styles.footer}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={44} />
        ))}
      </View>
    ) : history.isError && !history.data ? (
      <ErrorState message={userMessage(history.error, "load this conversation")} onRetry={() => history.refetch()} />
    ) : unsent ? null : (
      <View style={styles.welcome}>
        <EmptyState
          icon="sparkles-outline"
          title="Ask BuyWise"
          message="Ask a question, log an expense or plan a goal, in plain words."
        />
        {SUGGESTIONS.map((s) => (
          <Button key={s} title={s} variant="secondary" requiresNetwork disabled={busy} onPress={() => void submit(s)} />
        ))}
      </View>
    );

  const footer = (
    <View style={styles.footer}>
      {unsent ? <UserBubble text={unsent} /> : null}
      {busy ? (
        <View style={[styles.assistant, styles.composing]}>
          <ActivityIndicator color={theme.color.textMuted} />
          <Text tone="muted">Thinking…</Text>
        </View>
      ) : null}
      {send.isError && vars ? (
        <Pressable
          onPress={() => run(vars)}
          disabled={!online}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text variant="caption" tone="negative" align="right">
            {`${userMessage(send.error, "send this message")} Tap to retry.`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Screen title={title} back={back} keyboard scroll={false} insetBottom={back}>
      {actions ? <Row justify="between">{actions}</Row> : null}
      <FlatList
        ref={list}
        style={styles.list}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble message={item} live={item.id === liveId ? send.data : undefined} />}
        ListHeaderComponent={
          history.isError && history.data ? <Banner tone="warning" message="Couldn't refresh. Showing what we have." /> : null
        }
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      />
      <ChatInput
        value={draft}
        onChangeText={setDraft}
        onSend={() => {
          if (submit(draft)) setDraft("");
        }}
        busy={busy}
      />
    </Screen>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.user}>
      <Text tone="onAccent" selectable>
        {text}
      </Text>
    </View>
  );
}

function Bubble({ message, live }: { message: Message; live?: ChatResponse }) {
  if (message.role === "user") return <UserBubble text={message.content} />;
  return (
    <View style={styles.reply}>
      {live?.reasoning ? (
        <Disclosure header={<Text variant="caption" tone="muted">Thinking</Text>}>
          <Text variant="caption" tone="muted" selectable>
            {live.reasoning}
          </Text>
        </Disclosure>
      ) : null}
      <View style={[styles.assistant, message.status === "failed" && styles.failed]}>
        <Markdown>{message.content}</Markdown>
      </View>
      {live?.tool_calls.map((call, i) => <ToolCard key={`${call.tool_name}-${i}`} call={call} />)}
    </View>
  );
}

function ToolCard({ call }: { call: ToolCall }) {
  return (
    <Disclosure
      header={
        <>
          <Text variant="caption">{prettyToolName(call.tool_name)}</Text>
          <View style={styles.spacer} />
          <Text variant="caption" tone="positive">
            done
          </Text>
        </>
      }
    >
      <Text variant="caption" tone="muted" selectable>
        {`Input\n${JSON.stringify(call.tool_input, null, 2)}\n\nOutput\n${call.tool_output}`}
      </Text>
    </Disclosure>
  );
}

/** A collapsed card that opens to show detail. */
function Disclosure({ header, children }: { header: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.cardHeader}
      >
        <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={14} color={theme.color.textMuted} />
        {header}
      </Pressable>
      {open ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { flexGrow: 1, gap: theme.space.md, paddingBottom: theme.space.sm },
  welcome: { flexGrow: 1, justifyContent: "center", gap: theme.space.sm },
  footer: { gap: theme.space.md },
  user: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.lg,
  },
  reply: { gap: theme.space.xs },
  assistant: {
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
  },
  failed: { backgroundColor: theme.color.errorBg },
  composing: { flexDirection: "row", alignItems: "center", gap: theme.space.sm, alignSelf: "flex-start" },
  retry: { alignSelf: "flex-end", minHeight: theme.minHit, justifyContent: "center" },
  pressed: { opacity: 0.75 },
  card: {
    paddingHorizontal: theme.space.md,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: theme.space.sm, minHeight: theme.minHit },
  cardBody: { paddingBottom: theme.space.sm },
  spacer: { flex: 1 },
});
