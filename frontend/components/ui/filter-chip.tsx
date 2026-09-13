/**
 * FilterChip — the cream pill used for filters, tabs, and header actions across
 * Transactions, Budget, Goals, Reports. Active state = black pill.
 * (see .filter / .filter.on in the *.dc.html mockups)
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ className, active = false, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
        active
          ? "bg-primary text-background border-primary"
          : "bg-surface text-primary border-border hover:bg-surface-hover",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

FilterChip.displayName = "FilterChip";
