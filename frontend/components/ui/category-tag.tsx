/**
 * CategoryTag — DESIGN.md §6
 *
 * Colored pill used in transaction table, quick-add, and budget.
 */
import { cn } from "@/lib/utils";

interface CategoryTagProps {
  name: string;
  icon?: string | null;
  color?: string | null;
  className?: string;
}

const DEFAULT_COLORS = [
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "bg-pink-500/15 text-pink-400 border-pink-500/20",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function CategoryTag({ name, icon, color, className }: CategoryTagProps) {
  const colorClass = color
    ? undefined
    : DEFAULT_COLORS[hashString(name) % DEFAULT_COLORS.length];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border",
        colorClass,
        className
      )}
      style={
        color
          ? {
              backgroundColor: `${color}20`,
              color: color,
              borderColor: `${color}30`,
            }
          : undefined
      }
    >
      {icon && <span className="text-xs">{icon}</span>}
      {name}
    </span>
  );
}
