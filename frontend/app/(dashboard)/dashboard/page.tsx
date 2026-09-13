/**
 * Dashboard — colorful-cream reskin (see "Buywise backend colorful redesign"/_Dash.dc.html).
 * Hero balance card + income/spent tiles, budget snapshot, recent transactions, goals strip.
 * One balance, no accounts (backend dropped multi-account for a single ledger balance).
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Bell, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AmountText } from "@/components/ui/amount-text";
import { TransactionRow } from "@/components/ui/transaction-row";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { categoryStyle, categoryEmoji, HUES } from "@/lib/categories";
import { comingSoonProps } from "@/lib/coming-soon";
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

  // Backend /dashboard only accepts this_month/last_month, so the picker
  // can't be allowed to land on anything else.
  const prevMonthOfNow = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYearOfNow = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const handleMonthChange = (m: number, y: number) => {
    const isThisMonth = m === now.getMonth() + 1 && y === now.getFullYear();
    const isLastMonth = m === prevMonthOfNow && y === prevYearOfNow;
    if (isThisMonth || isLastMonth) {
      setMonth(m);
      setYear(y);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dashRes, goalsRes, txRes, budgetRes] = await Promise.allSettled([
          api.getDashboard(period),
          api.listGoals("active"),
          api.listTransactions({ period: "this_month", limit: 7 }),
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

  // Top budget categories closest to limit (sorted by percent_used desc)
  const topBudgets = [...budgets]
    .filter((b) => b.percent_used !== null)
    .sort((a, b) => (b.percent_used ?? 0) - (a.percent_used ?? 0))
    .slice(0, 5);

  const topGoals = goals.slice(0, 4);

  const isEmpty = !loading && transactions.length === 0 && !dashboard?.display_total_spent;

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
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 lg:p-8">
        {/* Small header row — no big title here, month switcher + coming-soon actions */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <h1 className="text-lg font-semibold text-primary">Dashboard</h1>
          <div className="flex items-center gap-2">
            <MonthSwitcher
              month={month}
              year={year}
              onChange={handleMonthChange}
            />
            <FilterChip aria-label="Search" {...comingSoonProps("Search")}>
              <Search className="w-3.5 h-3.5" />
            </FilterChip>
            <FilterChip aria-label="Notifications" {...comingSoonProps("Notifications")}>
              <Bell className="w-3.5 h-3.5" />
            </FilterChip>
          </div>
        </div>

        {/* Hero: balance card + income/spent tiles */}
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5 mb-5">
          <div className="relative overflow-hidden rounded-[22px] p-7 text-primary bg-gradient-to-br from-[#FF6F5C] to-[#F2C14E]">
            <div
              aria-hidden="true"
              className="absolute -top-10 -right-10 w-[220px] h-[220px] rounded-full bg-white/[0.18] pointer-events-none"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-[30px] right-[60px] w-[120px] h-[120px] rounded-full bg-black/[0.08] pointer-events-none"
            />
            <div className="relative">
              <div className="text-xs uppercase tracking-wider opacity-75">Total balance</div>
              {loading ? (
                <div className="h-16 w-64 max-w-full bg-black/10 rounded-xl animate-pulse-soft mt-2" />
              ) : (
                <AmountText
                  amount={dashboard?.display_current_balance ?? 0}
                  currency={currency}
                  context="balance"
                  size="hero"
                  className="text-[56px] sm:text-[64px]"
                />
              )}
              {!loading && (
                <div className="flex flex-wrap gap-6 mt-6 text-[13px]">
                  <div>
                    <span className="opacity-70">This month</span>
                    <div>
                      <AmountText amount={dashboard?.display_net ?? 0} currency={currency} sign size="md" />
                    </div>
                  </div>
                  <div>
                    <span className="opacity-70">Days left</span>
                    <div className="serif text-lg tabular-nums">
                      {dashboard?.days_remaining_in_month ?? 0} days
                    </div>
                  </div>
                  {dashboard?.has_budget && (
                    <div>
                      <span className="opacity-70">Ready to assign</span>
                      <div>
                        <AmountText amount={dashboard?.display_remaining_budget ?? 0} currency={currency} size="md" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div
              className="rounded-[18px] border p-5 flex items-center gap-4"
              style={{ backgroundColor: HUES.mint.bg, borderColor: HUES.mint.border }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: HUES.mint.bar }}
              >
                ↑
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider" style={{ color: HUES.mint.fg }}>
                  Income
                </div>
                {loading ? (
                  <div className="h-9 w-28 bg-black/10 rounded animate-pulse-soft mt-1" />
                ) : (
                  <AmountText
                    amount={dashboard?.display_total_income ?? 0}
                    currency={currency}
                    size="lg"
                    className="text-[32px] sm:text-[34px] leading-tight"
                  />
                )}
              </div>
            </div>
            <div
              className="rounded-[18px] border p-5 flex items-center gap-4"
              style={{ backgroundColor: HUES.coral.bg, borderColor: HUES.coral.border }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl text-white shrink-0"
                style={{ backgroundColor: HUES.coral.bar }}
              >
                ↓
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider" style={{ color: HUES.coral.fg }}>
                  Spent
                </div>
                {loading ? (
                  <div className="h-9 w-28 bg-black/10 rounded animate-pulse-soft mt-1" />
                ) : (
                  <AmountText
                    amount={dashboard?.display_total_spent ?? 0}
                    currency={currency}
                    size="lg"
                    className="text-[32px] sm:text-[34px] leading-tight"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: budget snapshot + recent transactions */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-5 mb-5">
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-[15px] text-primary">Budget snapshot</h2>
                <p className="text-xs text-secondary">Closest to limit</p>
              </div>
              <Link href="/budget" className="ml-auto text-xs text-secondary hover:text-primary shrink-0 pt-0.5">
                See all →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3.5 bg-surface-hover rounded w-3/4 animate-pulse-soft" />
                    <div className="h-2 bg-surface-hover rounded animate-pulse-soft" />
                  </div>
                ))}
              </div>
            ) : topBudgets.length === 0 ? (
              <p className="text-sm text-secondary text-center py-6">No budgets set for this month yet.</p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {topBudgets.map((b) => {
                  const style = categoryStyle(b.category);
                  return (
                    <div key={b.id}>
                      <div className="flex items-center gap-2 text-[13px] mb-1.5">
                        <span className="truncate">
                          {categoryEmoji(b.category)} {b.category || "Uncategorized"}
                        </span>
                        <span className="ml-auto shrink-0 flex items-center gap-1">
                          <AmountText
                            amount={b.display_spent ?? 0}
                            currency={currency}
                            size="sm"
                            className="!text-secondary"
                          />
                          <span className="text-secondary">/</span>
                          <AmountText
                            amount={b.display_budgeted_amount}
                            currency={currency}
                            size="sm"
                            className="!text-secondary"
                          />
                        </span>
                      </div>
                      <ProgressBar value={b.percent_used ?? 0} color={style.bar} overColor="#B93D28" size="sm" />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-[15px] text-primary">Recent transactions</h2>
                <p className="text-xs text-secondary">This month</p>
              </div>
              <Link href="/transactions" className="ml-auto text-xs text-secondary hover:text-primary shrink-0 pt-0.5">
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-surface-hover rounded-[10px] animate-pulse-soft shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-surface-hover rounded w-1/3 animate-pulse-soft" />
                      <div className="h-3 bg-surface-hover rounded w-1/4 animate-pulse-soft" />
                    </div>
                    <div className="h-4 bg-surface-hover rounded w-16 animate-pulse-soft" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-secondary text-center py-6">No transactions yet this month.</p>
            ) : (
              <div>
                {transactions.map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} variant="full" currency={currency} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Goals strip */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-semibold text-[15px] text-primary">Goals</h2>
            <Link href="/goals" className="ml-auto text-xs text-secondary hover:text-primary shrink-0">
              Manage →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-surface-hover rounded-[14px] animate-pulse-soft" />
              ))}
            </div>
          ) : topGoals.length === 0 ? (
            <p className="text-sm text-secondary text-center py-6">No active goals yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {topGoals.map((goal) => {
                const style = categoryStyle(goal.category);
                const emoji = goal.category ? categoryEmoji(goal.category) : "🎯";
                return (
                  <div
                    key={goal.id}
                    className="rounded-[14px] p-4 overflow-hidden"
                    style={{ backgroundColor: style.bg }}
                  >
                    <div className="text-xl leading-none">{emoji}</div>
                    <div className="mt-2 font-semibold text-sm text-primary truncate">{goal.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: style.fg }}>
                      <AmountText
                        amount={goal.display_current_amount}
                        currency={currency}
                        size="sm"
                        className="!text-inherit"
                      />
                      <span> / </span>
                      <AmountText
                        amount={goal.display_target_amount}
                        currency={currency}
                        size="sm"
                        className="!text-inherit"
                      />
                    </div>
                    <ProgressBar value={goal.progress_percent} color={style.bar} size="sm" className="mt-3" />
                    <div className="text-[11px] mt-1.5 tabular-nums" style={{ color: style.fg }}>
                      {Math.round(goal.progress_percent)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
