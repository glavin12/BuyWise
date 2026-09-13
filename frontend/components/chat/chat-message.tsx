"use client";

import { cn } from "@/lib/utils";
import type { Message, ToolCall } from "@/lib/types";

interface ChatMessageProps {
  message: Message;
  toolCalls?: ToolCall[];
}

const SparkAvatar = () => (
  <div className="flex-shrink-0 w-7 h-7 rounded-[9px] bg-gradient-to-br from-[#5EC5C1] to-[#6FA8DC] text-white flex items-center justify-center text-sm">
    ✦
  </div>
);

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

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-background px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const isError = message.status === "failed";

  return (
    <div className="flex gap-2.5 max-w-[85%] animate-fade-in">
      <SparkAvatar />
      <div className="space-y-2 min-w-0">
        <div
          className={cn(
            "inline-block rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed",
            isError
              ? "bg-[#FCE9E5] text-negative border border-[#F4C7BF]"
              : "bg-surface-hover text-primary"
          )}
        >
          {message.content || <span className="text-secondary italic">Thinking…</span>}
        </div>

        {toolCalls && toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {toolCalls.map((tc, i) => (
              <ToolCallCard key={`${tc.tool_name}-${i}`} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function prettyToolName(name: string): string {
  return name
    .replace(/^tool_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2">
      <div className="w-6 h-6 rounded-[7px] bg-[#DFF3F2] flex items-center justify-center text-xs">
        ✦
      </div>
      <span className="text-[13px] font-medium text-primary">
        {prettyToolName(toolCall.tool_name)}
      </span>
      <span className="ml-auto text-[10px] text-positive bg-[#E9F5EE] px-2 py-0.5 rounded-full">
        done
      </span>
    </div>
  );
}
