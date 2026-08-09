"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatEmpty } from "@/components/chat/chat-empty";
import { ComposingBubble, SkeletonMessages } from "@/components/chat/chat-loading";
import { api } from "@/lib/api";
import type { Message, ToolCall } from "@/lib/types";

export function ChatContainer() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [sending, setSending] = useState(false);
  const [newChatStarted, setNewChatStarted] = useState(false);
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isConversationLoading = Boolean(
    conversationId && loadedConversationId !== conversationId
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const data = await api.getMessages(conversationId);
        if (cancelled) return;
        setMessages(data.messages);
        setToolCalls([]);
        setNewChatStarted(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load messages:", err);
        setMessages([]);
        setToolCalls([]);
        setNewChatStarted(false);
      }
      setLoadedConversationId(conversationId);
    };

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  const handleSend = async (content: string) => {
    setSending(true);
    setToolCalls([]);
    if (!conversationId) setNewChatStarted(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      tool_call_id: null,
      status: "completed",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => (conversationId ? [...prev, userMessage] : [userMessage]));

    try {
      const response = await api.chat({
        message: content,
        conversation_id: conversationId,
        idempotency_key: crypto.randomUUID(),
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.response,
        tool_call_id: null,
        status: "completed",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setToolCalls(response.tool_calls || []);

      if (!conversationId && response.conversation_id) {
        router.push(`/chat/${response.conversation_id}`);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your request. Please try again.",
        tool_call_id: null,
        status: "failed",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const visibleMessages =
    conversationId
      ? loadedConversationId === conversationId
        ? messages
        : []
      : newChatStarted
        ? messages
        : [];

  if (isConversationLoading) {
    return (
      <>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            <SkeletonMessages />
          </div>
        </div>
        <ChatInput onSend={handleSend} disabled />
      </>
    );
  }

  if (visibleMessages.length === 0 && !sending) {
    return (
      <>
        <ChatEmpty onSuggestion={handleSend} />
        <ChatInput onSend={handleSend} disabled={sending} />
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {visibleMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              toolCalls={
                msg.role === "assistant" &&
                visibleMessages.indexOf(msg) === visibleMessages.length - 1
                  ? toolCalls
                  : undefined
              }
            />
          ))}
          {sending && <ComposingBubble />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput onSend={handleSend} disabled={sending} />
    </>
  );
}
