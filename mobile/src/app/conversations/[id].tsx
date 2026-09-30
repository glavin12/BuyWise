import { useLocalSearchParams, useRouter } from "expo-router";

import { isUuid } from "@/lib/ids";
import { ChatThread, NotFoundScreen } from "@/ui";

export default function ConversationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!isUuid(id)) return <NotFoundScreen title="Chat" what="Conversation" />;

  return (
    <ChatThread
      conversationId={id}
      // Back is History, even when nothing is behind this screen.
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/conversations"))}
      // dismissTo pops back to the tab shell (a navigate would stack a second one); the Chat tab starts a new chat on a fresh value.
      onNew={() => router.dismissTo({ pathname: "/chat", params: { fresh: String(Date.now()) } })}
    />
  );
}
