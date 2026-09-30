import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { ChatThread, goBack } from "@/ui";

/**
 * Always opens a new chat; History holds the earlier ones. Another screen asks for a new chat by
 * navigating here with a fresh `fresh` value (a timestamp): the thread is keyed on it.
 */
export default function ChatTab() {
  const router = useRouter();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const [thread, setThread] = useState(0); // a new key starts a fresh chat

  return (
    <ChatThread
      key={`${fresh ?? ""}:${thread}`}
      tab
      onBack={goBack}
      onHistory={() => router.push("/conversations")}
      onNew={() => setThread((n) => n + 1)}
    />
  );
}
