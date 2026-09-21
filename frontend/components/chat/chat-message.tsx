"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message, ToolCall } from "@/lib/types";

interface ChatMessageProps {
  message: Message;
  toolCalls?: ToolCall[];
  reasoning?: string | null;
}

// Minimal styling so markdown (bold, lists, tables, …) reads as formatted
// text instead of raw syntax, matching the chat bubble's own type scale
// rather than pulling in a full prose plugin for one bubble's worth of content.
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
  h1: ({ children }) => <h3 className="font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/[0.06] px-1 py-0.5 text-[13px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 last:mb-0 overflow-x-auto rounded-lg bg-black/[0.06] p-2.5 text-[13px]">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 last:mb-0 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};

const SparkAvatar = () => (
  <div className="flex-shrink-0 w-7 h-7 rounded-[9px] bg-gradient-to-br from-[#5EC5C1] to-[#6FA8DC] text-white flex items-center justify-center text-sm">
    ✦
  </div>
);

export function ChatMessage({ message, toolCalls, reasoning }: ChatMessageProps) {
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
        {reasoning && (
          <details className="group rounded-xl border border-border bg-surface px-3 py-2">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-secondary marker:content-none">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>
              Thinking
            </summary>
            <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-secondary">
              {reasoning}
            </div>
          </details>
        )}

        <div
          className={cn(
            "inline-block rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed",
            isError
              ? "bg-[#FCE9E5] text-negative border border-[#F4C7BF]"
              : "bg-surface-hover text-primary"
          )}
        >
          {message.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          ) : (
            <span className="text-secondary italic">Thinking…</span>
          )}
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
