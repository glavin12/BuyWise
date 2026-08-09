"use client";

import { cn } from "@/lib/utils";
import type { Message, ToolCall } from "@/lib/types";
import { User, Bot, Wrench } from "lucide-react";

interface ChatMessageProps {
  message: Message;
  toolCalls?: ToolCall[];
}

export function ChatMessage({ message, toolCalls }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  if (
    isTool ||
    message.role === "system" ||
    (message.role === "assistant" && !message.content && !toolCalls?.length)
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex gap-3 max-w-3xl animate-fade-in",
        isUser ? "ml-auto flex-row-reverse" : ""
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-accent text-white"
            : "bg-surface-hover text-accent border border-border"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={cn("space-y-2", isUser ? "text-right" : "")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-accent text-white rounded-br-md"
              : "bg-surface border border-border rounded-bl-md"
          )}
        >
          {message.content || (
            <span className="text-muted italic">Thinking...</span>
          )}
        </div>

        {toolCalls && toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {toolCalls.map((toolCall, i) => (
              <ToolCallDisplay key={`${toolCall.tool_name}-${i}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallDisplay() {
  return (
    <details className="group">
      <summary className="flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-accent transition-colors">
        <Wrench className="w-3 h-3" />
        <span className="font-medium">Checked account data</span>
      </summary>
      <div className="mt-1.5 p-3 bg-surface-hover border border-border rounded-lg text-xs text-secondary">
        BuyWise used current financial data to prepare this response.
      </div>
    </details>
  );
}
