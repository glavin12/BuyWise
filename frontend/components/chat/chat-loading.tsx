"use client";

import { Bot } from "lucide-react";

export function ComposingBubble() {
  return (
    <div className="flex gap-3 max-w-3xl animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-hover text-accent border border-border flex items-center justify-center">
        <Bot className="w-4 h-4" />
      </div>
      <div className="inline-block rounded-2xl rounded-bl-md px-4 py-3 bg-surface border border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-accent/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-accent/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonMessages() {
  return (
    <div className="space-y-6 animate-pulse-soft">
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-3 max-w-3xl">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-hover" />
          <div
            className={`rounded-2xl bg-surface border border-border ${
              i === 1 ? "w-48 h-12" : "w-64 h-16"
            }`}
          />
        </div>
      ))}
    </div>
  );
}
