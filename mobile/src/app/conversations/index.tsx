import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, MessagesSquare } from "lucide-react-native";
import { useState } from "react";

import { isNotFound, userMessage } from "@/lib/api";
import { groupConversations, type ConversationSection } from "@/lib/chat";
import { useDeleteConversation, usePendingChatIds } from "@/lib/mutations";
import { useOnline } from "@/lib/network";
import { conversationsQuery } from "@/lib/queries";
import type { Conversation } from "@/lib/types";
import { useRefetchStaleOnFocus } from "@/lib/useRefetchStaleOnFocus";
import {
  Banner,
  CircleButton,
  confirm,
  ConversationHeader,
  ConversationRow,
  ConversationSkeletons,
  EmptyState,
  ErrorState,
  goBack,
  hapticSuccess,
  Row,
  Screen,
  SectionedList,
  showToast,
  Stack,
  Title,
} from "@/ui";

// History, in Activity's style: back and "HISTORY", then the chats grouped Today / This week / Older
// with relative times. Tap opens one, long-press deletes it (after a confirm).

export default function ConversationsScreen() {
  const router = useRouter();
  const list = useQuery(conversationsQuery);
  const remove = useDeleteConversation();
  const pending = usePendingChatIds();
  const online = useOnline();
  const [refreshing, setRefreshing] = useState(false);
  useRefetchStaleOnFocus();

  const sections = groupConversations(list.data ?? [], new Date());

  const refresh = async () => {
    if (refreshing) return; // G4: ignore a second pull while one is running
    setRefreshing(true);
    try {
      await list.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const askDelete = async (conversation: Conversation) => {
    const ok = await confirm(
      "Delete this chat?",
      `"${conversation.title || "New conversation"}" and all its messages will be deleted.`,
      "Delete",
      true
    );
    if (!ok) return;
    remove.mutate(conversation.id, {
      onSuccess: () => {
        hapticSuccess();
        showToast("Chat deleted");
      },
      onError: (err) => {
        if (!isNotFound(err)) showToast(userMessage(err, "delete this chat")); // a 404 means it is already gone
      },
    });
  };

  const header = (
    <Stack gap="md">
      <Row>
        <CircleButton icon={ArrowLeft} label="Go back" onPress={goBack} />
        <Title>History</Title>
      </Row>
      {list.isError && list.data ? <Banner tone="warning" message="Couldn't refresh. Showing what we have." /> : null}
    </Stack>
  );

  const empty = list.isPending ? (
    <ConversationSkeletons />
  ) : list.isError && !list.data ? (
    <ErrorState title="Can't load chats" message={userMessage(list.error, "load your chats")} onRetry={() => list.refetch()} />
  ) : (
    <EmptyState
      icon={MessagesSquare}
      title="No chats yet"
      message="Your conversations with BuyWise show up here."
      actionLabel="Start a chat"
      onAction={() => router.dismissTo({ pathname: "/chat", params: { fresh: String(Date.now()) } })} // back to the tab shell, on a new chat
    />
  );

  return (
    <Screen surface="screen" scroll={false}>
      <SectionedList
        sections={sections}
        keyExtractor={(c) => c.id}
        renderItem={(c) => (
          <ConversationRow
            conversation={c}
            onPress={(id) => router.push(`/conversations/${id}`)}
            onLongPress={askDelete}
            locked={!online || pending.includes(c.id)} // AI7: never delete a chat whose reply is on its way
          />
        )}
        renderSectionHeader={(section: ConversationSection) => <ConversationHeader title={section.title} />}
        header={header}
        empty={empty}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </Screen>
  );
}
