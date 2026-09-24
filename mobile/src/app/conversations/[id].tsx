import { useLocalSearchParams } from "expo-router";

import { isUuid } from "@/lib/ids";
import { ChatThread, NotFoundScreen } from "@/ui";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <NotFoundScreen title="Chat" what="Conversation" />;
  return <ChatThread conversationId={id} title="Chat" back />;
}
