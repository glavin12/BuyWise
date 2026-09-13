/**
 * Chat shell — colorful-cream (see _Chat.dc.html).
 *
 * Two-column: conversations rail + the active conversation (the routed page,
 * which renders <ChatContainer/>). One layout wraps both /chat and /chat/[id].
 */
"use client";

import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ConversationList } from "@/components/sidebar/conversation-list";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : undefined;

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full">
      <div className="mb-4 sm:mb-5">
        <h1 className="serif text-[32px] sm:text-[44px] leading-none">Chat with BuyWise</h1>
        <p className="text-sm text-secondary mt-1.5">
          Ask, log, plan. Everything Chat can do is also a normal form somewhere.
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5 h-[calc(100dvh-11rem)] min-h-[460px]">
        <Card variant="flat" className="hidden lg:flex flex-col overflow-hidden p-3">
          <ConversationList activeId={activeId} />
        </Card>
        <Card variant="flat" className="flex flex-col overflow-hidden min-w-0">
          {children}
        </Card>
      </div>
    </div>
  );
}
