/**
 * ProgressBar — DESIGN.md §6
 *
 * Shared primitive for budget category bars and goal cards.
 * Color shifts: green → amber (near limit, >75%) → red (over, >100%) per §4.
 */
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100+
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

function getBarColor(percent: number): string {
  if (percent >= 100) return "bg-red-500";
  if (percent >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

export function ProgressBar({
  value,
  className,
  size = "md",
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "w-full rounded-full bg-zinc-800 overflow-hidden",
          size === "sm" ? "h-1.5" : "h-2"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            getBarColor(value)
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium tabular-nums min-w-[36px] text-right",
            value >= 100
              ? "text-red-400"
              : value >= 75
                ? "text-amber-400"
                : "text-zinc-400"
          )}
        >
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}
