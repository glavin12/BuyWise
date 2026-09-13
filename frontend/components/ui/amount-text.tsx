/**
 * AmountText — DESIGN.md §6
 *
 * Renders display_* values with tabular-nums. Every currency amount in the app
 * goes through this component, no exceptions.
 *
 * "Colorful cream": md/lg/hero use Instrument Serif; sm stays sans (dense rows,
 * meta). Colour rules per §4: positive/income green (#3E7A5A), status-negative
 * red (#B93D28), everything else primary ink. Expenses are neutral ink — the
 * "−" sign carries the meaning, not colour.
 */
"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface AmountTextProps {
  amount: number;
  currency?: string;
  context?:
    | "income"
    | "expense"
    | "balance"
    | "neutral"
    | "status-positive"
    | "status-negative";
  sign?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "hero";
}

export function AmountText({
  amount,
  currency = "INR",
  context = "neutral",
  sign = false,
  className,
  size = "md",
}: AmountTextProps) {
  const formatted = formatCurrency(Math.abs(amount), currency);
  const prefix = sign ? (amount >= 0 ? "+" : "−") : amount < 0 ? "−" : "";

  const colorClass =
    context === "income" || context === "status-positive"
      ? "text-positive"
      : context === "status-negative"
        ? "text-negative"
        : context === "balance" && amount < 0
          ? "text-negative"
          : "text-primary";

  const sizeClass =
    size === "hero"
      ? "serif text-[44px] leading-none"
      : size === "lg"
        ? "serif text-xl"
        : size === "md"
          ? "serif text-lg"
          : "text-xs font-medium";

  return (
    <span
      className={cn("tabular-nums", sizeClass, colorClass, className)}
    >
      {prefix}
      {formatted}
    </span>
  );
}
