"use client";

export function ComposingBubble() {
  return (
    <div className="flex gap-2.5 max-w-[85%] animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-[9px] bg-gradient-to-br from-[#5EC5C1] to-[#6FA8DC] text-white flex items-center justify-center text-sm">
        ✦
      </div>
      <div className="inline-block rounded-2xl rounded-bl-md px-4 py-3 bg-surface-hover">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-secondary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-secondary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-secondary/60 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonMessages() {
  return (
    <div className="space-y-6 animate-pulse-soft">
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-2.5 max-w-[85%]">
          <div className="flex-shrink-0 w-7 h-7 rounded-[9px] bg-surface-hover" />
          <div
            className={`rounded-2xl bg-surface-hover ${
              i === 1 ? "w-48 h-12" : "w-64 h-16"
            }`}
          />
        </div>
      ))}
    </div>
  );
}
