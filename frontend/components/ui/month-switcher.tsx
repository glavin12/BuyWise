/**
 * MonthSwitcher — DESIGN.md §6
 *
 * Cream pill with chevrons, black text. Shared by Dashboard, Budget, Reports.
 */
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MonthSwitcherProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
  className?: string;
}

export function MonthSwitcher({
  month,
  year,
  onChange,
  className,
}: MonthSwitcherProps) {
  const handlePrev = () => {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  };

  const handleNext = () => {
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 bg-surface-hover border border-border rounded-[10px] p-0.5",
        className
      )}
    >
      <button
        onClick={handlePrev}
        className="p-1.5 rounded-[7px] hover:bg-border text-secondary hover:text-primary transition-colors cursor-pointer"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium text-primary min-w-[132px] text-center select-none tabular-nums">
        {formatMonth(month, year)}
      </span>
      <button
        onClick={handleNext}
        className="p-1.5 rounded-[7px] hover:bg-border text-secondary hover:text-primary transition-colors cursor-pointer"
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
