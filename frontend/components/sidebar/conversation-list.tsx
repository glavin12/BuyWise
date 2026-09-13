"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Conversation } from "@/lib/types";

interface ConversationListProps {
  activeId?: string;
}

function bucketOf(c: Conversation): "Today" | "This week" | "Older" {
  const ts = c.last_message_at || c.created_at;
  if (!ts) return "Older";
  const days = (Date.now() - new Date(ts).getTime()) / 86_400_000;
  if (days < 1) return "Today";
  if (days < 7) return "This week";
  return "Older";
}

const GROUPS = ["Today", "This week", "Older"] as const;

export function ConversationList({ activeId }: ConversationListProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listConversations()
      .then((data) => {
        if (!cancelled) setConversations(data);
      })
      .catch((err) => console.error("Failed to load conversations:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(id);
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) router.push("/chat");
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => router.push("/chat")}
        className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-background hover:bg-accent-hover transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        New chat
      </button>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
        {loading ? (
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-surface-hover rounded-xl animate-pulse-soft" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageSquare className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-xs text-secondary">No conversations yet</p>
          </div>
        ) : (
          GROUPS.map((group) => {
            const items = conversations.filter((c) => bucketOf(c) === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-2 pb-1.5 pt-1 text-[11px] uppercase tracking-[0.1em] text-secondary">
                  {group}
                </div>
                <div className="space-y-1">
                  {items.map((conv) => {
                    const active = activeId === conv.id;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => router.push(`/chat/${conv.id}`)}
                        className={cn(
                          "group flex items-start gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors border",
                          active
                            ? "bg-[#FCE9E5] border-[#F4C7BF]"
                            : "border-transparent hover:bg-surface-hover"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-primary">
                            {conv.title || "New conversation"}
                          </div>
                          <div className="mt-0.5 text-[11px] text-secondary">
                            {(conv.last_message_at || conv.created_at) &&
                              timeAgo(conv.last_message_at || conv.created_at)}
                            {conv.message_count ? ` · ${conv.message_count} msgs` : ""}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          disabled={deletingId === conv.id}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface transition-all cursor-pointer"
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-secondary hover:text-negative" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
