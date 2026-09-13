/**
 * ProgressBar — DESIGN.md §6
 *
 * Track #F0E6D2, 8px tall. Fill colour is the CATEGORY colour (pass `color`),
 * not a traffic light — the mockups keep each category its own hue regardless of
 * fullness. Optionally pass `overColor` to flip the fill when over 100% (budget
 * over-spend), which the mockups render in coral/red.
 */
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100+
  /** fill colour (hex from lib/categories). Defaults to the ink colour. */
  color?: string;
  /** fill colour when value >= 100 (e.g. over-budget). */
  overColor?: string;
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  color = "#1B1B1B",
  overColor,
  className,
  size = "md",
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(value, 100));
  const fill = value >= 100 && overColor ? overColor : color;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "w-full rounded-full overflow-hidden",
          size === "sm" ? "h-1.5" : "h-2"
        )}
        style={{ backgroundColor: "#F0E6D2" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: fill }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-medium tabular-nums min-w-[36px] text-right text-secondary">
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}
