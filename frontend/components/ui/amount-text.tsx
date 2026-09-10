/**
 * AmountText — DESIGN.md §6
 *
 * Renders display_* values with tabular-nums. Every currency amount in the app
 * goes through this component, no exceptions.
 *
 * Color rules per §4: green for income/positive status, red ONLY for status
 * (over-budget, negative balance), neutral for expenses in lists.
 */
"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface AmountTextProps {
  amount: number;
  currency?: string;
  context?: "income" | "expense" | "balance" | "neutral" | "status-positive" | "status-negative";
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
      ? "text-emerald-400"
      : context === "status-negative"
        ? "text-red-400"
        : context === "balance" && amount < 0
          ? "text-red-400"
          : context === "balance"
            ? "text-zinc-100"
            : "text-zinc-100";

  const sizeClass =
    size === "hero"
      ? "text-[28px] font-semibold"
      : size === "lg"
        ? "text-xl font-semibold"
        : size === "sm"
          ? "text-xs"
          : "text-sm font-medium";

  return (
    <span
      className={cn(
        "tabular-nums tracking-tight",
        colorClass,
        sizeClass,
        className
      )}
    >
      {prefix}
      {formatted}
    </span>
  );
}
