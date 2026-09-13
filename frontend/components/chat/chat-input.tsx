"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const QUICK_ACTIONS = [
  { label: "💡 Log expense", prefill: "Log an expense: " },
  { label: "📊 Compare months", prefill: "Compare my spending this month vs last month" },
  { label: "🎯 Fund a goal", prefill: "Add a contribution to my goal " },
  { label: "🔎 Spending by category", prefill: "How much did I spend on " },
];

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Try: “add ₹580 dinner at Social to Food, UPI”",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  };

  const prefill = (text: string) => {
    setMessage(text);
    const el = textareaRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => {
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        el.setSelectionRange(text.length, text.length);
      });
    }
  };

  return (
    <div className="border-t border-border p-3 sm:p-4">
      <div className="mb-2.5 flex gap-2 overflow-x-auto pb-0.5">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => prefill(a.prefill)}
            disabled={disabled}
            className="whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2 bg-surface-hover rounded-2xl p-1.5 pl-3 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 py-2 text-sm bg-transparent resize-none focus:outline-none placeholder:text-secondary/70 min-h-[36px] max-h-[160px] text-primary",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          aria-label="Send message"
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
            message.trim() && !disabled
              ? "bg-[#FF6F5C] text-white hover:brightness-95"
              : "bg-border text-secondary cursor-not-allowed"
          )}
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-secondary text-center mt-2">
        BuyWise AI can make mistakes. Verify important financial information.
      </p>
    </div>
  );
}
