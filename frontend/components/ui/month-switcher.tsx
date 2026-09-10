/**
 * MonthSwitcher — DESIGN.md §6
 *
 * Shared by Dashboard, Budget, Reports. One component, not three date pickers.
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
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-1 py-1",
        className
      )}
    >
      <button
        onClick={handlePrev}
        className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium text-zinc-100 min-w-[140px] text-center select-none">
        {formatMonth(month, year)}
      </span>
      <button
        onClick={handleNext}
        className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
