/**
 * ProgressRing — DESIGN.md §6
 *
 * SVG ring variant for goal cards. Shares the same color logic as ProgressBar.
 */
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number; // 0-100
  size?: number; // px
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}

function getRingColor(percent: number): string {
  if (percent >= 100) return "stroke-emerald-400";
  if (percent >= 75) return "stroke-emerald-400";
  if (percent >= 50) return "stroke-blue-400";
  return "stroke-zinc-400";
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  className,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-800"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-700 ease-out", getRingColor(value))}
        />
      </svg>
      {/* Center content */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
