import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
  confirm,
  ConversationRow,
  EmptyState,
  ErrorState,
  hapticSuccess,
  Screen,
  SectionedList,
  SectionHeader,
  showToast,
  Skeleton,
  Stack,
} from "@/ui";

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
    if (refreshing) return; // ignore a second pull while one is running
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

  const empty = list.isPending ? (
    <Stack>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={52} />
      ))}
    </Stack>
  ) : list.isError && !list.data ? (
    <ErrorState message={userMessage(list.error, "load your chats")} onRetry={() => list.refetch()} />
  ) : (
    <EmptyState icon="chatbubbles-outline" title="No chats yet" message="Your conversations with BuyWise show up here." />
  );

  return (
    <Screen title="History" back scroll={false}>
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
        renderSectionHeader={(section: ConversationSection) => <SectionHeader title={section.title} />}
        header={list.isError && list.data ? <Banner tone="warning" message="Couldn't refresh. Showing what we have." /> : undefined}
        empty={empty}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </Screen>
  );
}
