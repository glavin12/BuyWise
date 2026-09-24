import { useRouter } from "expo-router";
import { useState } from "react";

import { Button, ChatThread } from "@/ui";

/** Always opens a new chat; History holds the earlier ones. */
export default function ChatTab() {
  const router = useRouter();
  const [thread, setThread] = useState(0); // a new key starts a fresh chat

  return (
    <ChatThread
      key={thread}
      title="Chat"
      actions={
        <>
          <Button title="History" variant="link" onPress={() => router.push("/conversations")} />
          <Button title="New chat" variant="link" onPress={() => setThread((n) => n + 1)} />
        </>
      }
    />
  );
}
