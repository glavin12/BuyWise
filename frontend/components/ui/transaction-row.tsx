/**
 * TransactionRow — DESIGN.md §6
 *
 * Full and compact variants, used on Dashboard, Transactions, and Chat confirmations.
 *
 * §4 color rules: Don't color every expense row red. Keep the list in neutral text
 * and reserve red/green for status (over-budget, account balance sign).
 *
 * §5.2: Transfers render as a single logical row (both legs collapsed into one line
 * with a transfer icon).
 */
"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmountText } from "@/components/ui/amount-text";
import { CategoryTag } from "@/components/ui/category-tag";
import { formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

interface TransactionRowProps {
  transaction: Transaction;
  variant?: "full" | "compact";
  currency?: string;
  onClick?: () => void;
  className?: string;
}

function getTypeIcon(type: string, direction?: string | null) {
  if (type === "transfer") {
    return (
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
      </div>
    );
  }
  if (type === "income" || type === "starting_balance") {
    return (
      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
      </div>
    );
  }
  // expense — neutral icon, NOT red per §4
  return (
    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
      <ArrowDownLeft className="w-3.5 h-3.5 text-zinc-400" />
    </div>
  );
}

export function TransactionRow({
  transaction: tx,
  variant = "full",
  currency = "INR",
  onClick,
  className,
}: TransactionRowProps) {
  const isTransfer = tx.transaction_type === "transfer";
  const isIncome = tx.transaction_type === "income" || tx.transaction_type === "starting_balance";

  // Per §4: neutral text for expenses, green only for income
  const amountContext = isIncome ? "income" : isTransfer ? "neutral" : "neutral";
  const amountSign = isIncome;

  const description =
    tx.description ||
    tx.payee ||
    (isTransfer
      ? `Transfer ${tx.transfer_direction === "out" ? "to" : "from"} account`
      : tx.transaction_type === "starting_balance"
        ? "Starting balance"
        : "Transaction");

  if (variant === "compact") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 py-2 transition-colors",
          onClick && "cursor-pointer hover:bg-zinc-900/50 -mx-2 px-2 rounded-lg",
          className
        )}
      >
        {getTypeIcon(tx.transaction_type, tx.transfer_direction)}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-100 truncate">{description}</p>
          <p className="text-xs text-zinc-500">
            {tx.category || (isTransfer ? "Transfer" : tx.account || "")}
          </p>
        </div>
        <AmountText
          amount={tx.display_amount}
          currency={currency}
          context={amountContext}
          sign={amountSign}
          size="sm"
        />
      </div>
    );
  }

  // Full variant
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 py-3 border-b border-zinc-800/50 last:border-0 transition-colors group",
        onClick && "cursor-pointer hover:bg-zinc-900/50 -mx-2 px-2 rounded-lg",
        className
      )}
    >
      {getTypeIcon(tx.transaction_type, tx.transfer_direction)}

      {/* Description + payee */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-100 truncate">{description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {tx.payee && tx.description && (
            <span className="text-xs text-zinc-500 truncate">{tx.payee}</span>
          )}
        </div>
      </div>

      {/* Category tag */}
      <div className="hidden sm:block">
        {tx.category ? (
          <CategoryTag
            name={tx.category}
            icon={tx.category_icon}
          />
        ) : isTransfer ? (
          <CategoryTag name="Transfer" />
        ) : null}
      </div>

      {/* Account */}
      <div className="hidden md:block">
        <span className="text-xs text-zinc-500">{tx.account}</span>
      </div>

      {/* Date */}
      <div className="hidden sm:block min-w-[60px] text-right">
        <span className="text-xs text-zinc-500 tabular-nums">
          {formatDate(tx.transaction_date)}
        </span>
      </div>

      {/* Cleared status */}
      <div className="hidden lg:flex items-center">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            tx.cleared_status === "cleared" ? "bg-emerald-500" : "bg-zinc-600"
          )}
          title={tx.cleared_status}
        />
      </div>

      {/* Amount — right-aligned, tabular-nums */}
      <div className="min-w-[90px] text-right">
        <AmountText
          amount={tx.display_amount}
          currency={currency}
          context={amountContext}
          sign={amountSign}
        />
      </div>
    </div>
  );
}
