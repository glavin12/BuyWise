/**
 * TransactionRow — DESIGN.md §6
 *
 * Colorful-cream row: category-tinted emoji tile · payee + meta (date ·
 * payment method) · category chip · serif amount. Used on Dashboard (compact)
 * and Chat confirmations. The Transactions page builds its own dense table.
 *
 * §4 colour rules: expenses stay neutral ink (the "−" carries meaning); income
 * is green. No per-row red.
 */
"use client";

import { cn } from "@/lib/utils";
import { AmountText } from "@/components/ui/amount-text";
import { CategoryTag } from "@/components/ui/category-tag";
import { formatDate } from "@/lib/format";
import { categoryStyle, categoryEmoji, paymentMethodLabel } from "@/lib/categories";
import type { Transaction } from "@/lib/types";

interface TransactionRowProps {
  transaction: Transaction;
  variant?: "full" | "compact";
  currency?: string;
  onClick?: () => void;
  className?: string;
}

export function TransactionRow({
  transaction: tx,
  variant = "full",
  currency = "INR",
  onClick,
  className,
}: TransactionRowProps) {
  const isIncome =
    tx.transaction_type === "income" ||
    tx.transaction_type === "starting_balance";

  const label =
    tx.payee ||
    tx.description ||
    (tx.transaction_type === "starting_balance" ? "Starting balance" : "Transaction");

  const style = categoryStyle(tx.category);
  const emoji = tx.category_icon || categoryEmoji(tx.category);
  const metaParts = [formatDate(tx.transaction_date)];
  if (tx.payment_method) metaParts.push(paymentMethodLabel(tx.payment_method));

  const tile = (
    <div
      className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base shrink-0"
      style={{ backgroundColor: style.bg }}
    >
      {emoji}
    </div>
  );

  if (variant === "compact") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 py-2.5 transition-colors",
          onClick && "cursor-pointer hover:bg-surface-hover -mx-2 px-2 rounded-lg",
          className
        )}
      >
        {tile}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">{label}</p>
          <p className="text-xs text-secondary truncate">{metaParts.join(" · ")}</p>
        </div>
        <AmountText
          amount={tx.display_amount}
          currency={currency}
          context={isIncome ? "income" : "neutral"}
          sign={isIncome}
          size="md"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 py-2.5 border-b border-divider last:border-0 transition-colors",
        onClick && "cursor-pointer hover:bg-surface-hover -mx-2 px-2 rounded-lg",
        className
      )}
    >
      {tile}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{label}</p>
        <p className="text-xs text-secondary truncate">{metaParts.join(" · ")}</p>
      </div>
      {tx.category && (
        <div className="hidden sm:block">
          <CategoryTag name={tx.category} icon={tx.category_icon} />
        </div>
      )}
      <AmountText
        amount={tx.display_amount}
        currency={currency}
        context={isIncome ? "income" : "neutral"}
        sign={isIncome}
        size="lg"
        className="min-w-[90px] text-right"
      />
    </div>
  );
}
