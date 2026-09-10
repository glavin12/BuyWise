/**
 * Dashboard — DESIGN.md §5.1
 *
 * The Monarch-style "everything at a glance" screen.
 * 1. Header row: total balance, month switcher, quick-add
 * 2. Three stat cards: Income, Expenses, Left to Spend
 * 3. Budget snapshot: top 3-5 categories closest to limit
 * 4. Recent transactions: 5-8 rows using TransactionRow compact
 * 5. Goals strip: horizontal scroll of progress cards
 *
 * Empty state: "Add your first transaction" with quick-add button per §5.1.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowRight,
  Target,
  Receipt,
  PiggyBank,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmountText } from "@/components/ui/amount-text";
import { TransactionRow } from "@/components/ui/transaction-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { DashboardData, Goal, Transaction, Budget } from "@/lib/types";

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();
  const period = isCurrentMonth ? "this_month" : "last_month";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dashRes, goalsRes, txRes, budgetRes] = await Promise.allSettled([
          api.getDashboard(period),
          api.listGoals("active"),
          api.listTransactions({ limit: 8, period }),
          api.getMonthBudgets(year, month),
        ]);
        if (dashRes.status === "fulfilled") setDashboard(dashRes.value);
        if (goalsRes.status === "fulfilled") setGoals(goalsRes.value.goals);
        if (txRes.status === "fulfilled") setTransactions(txRes.value.transactions);
        if (budgetRes.status === "fulfilled") setBudgets(budgetRes.value.budgets);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [month, year, period]);

  const currency = dashboard?.currency || "INR";

  // Total balance across all accounts
  const totalBalance =
    dashboard?.account_balances?.reduce((sum, a) => sum + a.display_balance, 0) ?? 0;

  // Top budget categories closest to limit (sorted by percent_used desc)
  const topBudgets = [...budgets]
    .filter((b) => b.percent_used !== null)
    .sort((a, b) => (b.percent_used ?? 0) - (a.percent_used ?? 0))
    .slice(0, 5);

  // Empty state check
  const isEmpty = !loading && transactions.length === 0 && !dashboard?.total_spent;

  if (isEmpty) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <EmptyState
            icon={<Receipt className="w-7 h-7" />}
            title="Add your first transaction to see your spending here"
            description="Use the + Add Transaction button in the sidebar or ask the AI chat to add one for you."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* §5.1.1 Header row: total balance, month switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-zinc-500">Total Balance</span>
              {loading ? (
                <div className="h-6 bg-zinc-800 rounded w-28 animate-pulse-soft" />
              ) : (
                <AmountText
                  amount={totalBalance}
                  currency={currency}
                  context="balance"
                  size="lg"
                />
              )}
            </div>
          </div>
          <MonthSwitcher month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>

        {/* §5.1.2 Three stat cards: Income, Expenses, Left to Spend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Income"
            loading={loading}
            amount={dashboard?.display_total_income ?? 0}
            currency={currency}
            context="income"
            bg="bg-emerald-500/10"
            iconColor="text-emerald-400"
          />
          <StatCard
            icon={<TrendingDown className="w-5 h-5" />}
            label="Expenses"
            loading={loading}
            amount={dashboard?.display_total_spent ?? 0}
            currency={currency}
            context="neutral"
            bg="bg-zinc-800"
            iconColor="text-zinc-400"
          />
          <StatCard
            icon={<Wallet className="w-5 h-5" />}
            label="Left to Spend"
            loading={loading}
            amount={dashboard?.display_net ?? 0}
            currency={currency}
            context="balance"
            bg="bg-blue-500/10"
            iconColor="text-blue-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* §5.1.3 Budget snapshot */}
          <Card className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-zinc-100 flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-emerald-400" />
                Budget
              </h2>
              <Link href="/budget">
                <Button variant="ghost" size="sm">
                  See full budget <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse-soft" />
                    <div className="h-2 bg-zinc-800 rounded animate-pulse-soft" />
                  </div>
                ))}
              </div>
            ) : topBudgets.length === 0 ? (
              <div className="text-center py-6">
                <PiggyBank className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No budgets set</p>
                <Link href="/budget">
                  <Button variant="ghost" size="sm" className="mt-2">
                    Set your first budget
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {topBudgets.map((b) => (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300 truncate">
                        {b.category || "Uncategorized"}
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {formatCurrency(b.display_spent ?? 0, currency)} / {formatCurrency(b.display_budgeted_amount, currency)}
                      </span>
                    </div>
                    <ProgressBar value={b.percent_used ?? 0} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* §5.1.4 Recent transactions — TransactionRow compact */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-zinc-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Recent Transactions
              </h2>
              <Link href="/transactions">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-lg animate-pulse-soft" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-zinc-800 rounded w-1/3 animate-pulse-soft" />
                      <div className="h-3 bg-zinc-800 rounded w-1/4 animate-pulse-soft" />
                    </div>
                    <div className="h-4 bg-zinc-800 rounded w-16 animate-pulse-soft" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6">
                <Receipt className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    variant="compact"
                    currency={currency}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* §5.1.5 Goals strip — only shown if goals exist */}
        {goals.length > 0 && (
          <Card className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-zinc-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                Goals
              </h2>
              <Link href="/goals">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {goals.slice(0, 6).map((goal) => (
                <div
                  key={goal.id}
                  className="flex-shrink-0 flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl min-w-[200px]"
                >
                  <ProgressRing value={goal.progress_percent} size={48} strokeWidth={4}>
                    <span className="text-[10px] font-medium text-zinc-300 tabular-nums">
                      {Math.round(goal.progress_percent)}%
                    </span>
                  </ProgressRing>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">
                      {goal.title}
                    </p>
                    <p className="text-xs text-zinc-500 tabular-nums">
                      {formatCurrency(goal.display_current_amount, currency)} / {formatCurrency(goal.display_target_amount, currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  loading,
  amount,
  currency,
  context,
  bg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  amount: number;
  currency: string;
  context: "income" | "neutral" | "balance";
  bg: string;
  iconColor: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">{label}</p>
          {loading ? (
            <div className="h-6 bg-zinc-800 rounded w-24 animate-pulse-soft mt-0.5" />
          ) : (
            <AmountText
              amount={amount}
              currency={currency}
              context={context}
              size="lg"
            />
          )}
        </div>
      </div>
    </Card>
  );
}
