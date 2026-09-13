/**
 * CategoryTag — DESIGN.md §6
 *
 * Pastel pill: pastel bg + darker matching fg (e.g. Groceries green). All colour
 * comes from lib/categories — no per-page hex. Emoji is optional; when omitted
 * we use the category's own emoji from the map.
 */
import { cn } from "@/lib/utils";
import { categoryStyle, categoryEmoji } from "@/lib/categories";

interface CategoryTagProps {
  name: string;
  /** override emoji; defaults to the category's mapped emoji */
  icon?: string | null;
  /** show the leading emoji (default true) */
  showEmoji?: boolean;
  className?: string;
}

export function CategoryTag({
  name,
  icon,
  showEmoji = true,
  className,
}: CategoryTagProps) {
  const style = categoryStyle(name);
  const emoji = icon ?? categoryEmoji(name);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        className
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {showEmoji && emoji && <span className="text-xs leading-none">{emoji}</span>}
      {name}
    </span>
  );
}
