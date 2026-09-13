/**
 * Balance — repurposed from the old multi-account screen.
 *
 * The multi-account model was removed from the backend: there is one
 * ledger-derived balance per user, and each transaction carries an optional
 * `payment_method` instead of an account_id. This screen shows that balance,
 * a breakdown by payment method, and recent activity. Route stays `/accounts`;
 * the sidebar already labels it "Balance".
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AmountText } from "@/components/ui/amount-text";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { TransactionRow } from "@/components/ui/transaction-row";
import { api } from "@/lib/api";
import { paymentMethodInfo } from "@/lib/categories";
import { comingSoonProps } from "@/lib/coming-soon";
import type { DashboardData, PaymentMethodSpending, Transaction } from "@/lib/types";

export default function AccountsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [methods, setMethods] = useState<PaymentMethodSpending[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // getDashboard only accepts a period keyword, not an arbitrary month/year —
  // same this_month/last_month mapping the Dashboard screen uses.
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const period = isCurrentMonth ? "this_month" : "last_month";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, methodsRes, txRes] = await Promise.allSettled([
        api.getDashboard(period),
        api.paymentMethodAnalytics(month, year),
        api.listTransactions({ period: "this_month", limit: 6 }),
      ]);
      if (dashRes.status === "fulfilled") setDashboard(dashRes.value);
      if (methodsRes.status === "fulfilled") setMethods(methodsRes.value);
      if (txRes.status === "fulfilled") setTransactions(txRes.value.transactions);
    } catch (err) {
      console.error("Failed to load balance:", err);
    } finally {
      setLoading(false);
    }
  }, [month, year, period]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = dashboard?.currency || "INR";

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="p-4 sm:p-5 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="serif text-[44px] leading-none">Balance</h1>
            <p className="text-sm text-secondary mt-1.5">
              Your balance is computed from your transactions — here&apos;s where your money moves.
            </p>
          </div>
          <MonthSwitcher
            month={month}
            year={year}
            onChange={(m, y) => {
              setMonth(m);
              setYear(y);
            }}
          />
        </div>

        {/* Hero balance card */}
        {loading ? (
          <div className="h-[190px] rounded-[22px] mb-6 bg-surface-hover border border-border animate-pulse-soft" />
        ) : (
          <div className="bg-gradient-to-br from-[#FF6F5C] to-[#F2C14E] rounded-[22px] p-7 mb-6">
            <p className="text-xs uppercase tracking-wider text-primary/70">Current balance</p>
            <AmountText
              amount={dashboard?.display_current_balance ?? 0}
              currency={currency}
              context="balance"
              size="hero"
              className="text-[56px] sm:text-[64px]"
            />
            <div className="flex gap-6 mt-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-primary/70">In</span>
                <AmountText amount={dashboard?.display_total_income ?? 0} currency={currency} size="sm" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-primary/70">Out</span>
                <AmountText amount={dashboard?.display_total_spent ?? 0} currency={currency} size="sm" />
              </div>
            </div>
          </div>
        )}

        {/* Payment-method cards */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[120px] rounded-[18px] bg-surface-hover border border-border animate-pulse-soft" />
            ))}
          </div>
        ) : methods.length === 0 ? (
          <Card className="mb-6">
            <EmptyState
              icon={<Wallet className="w-7 h-7" />}
              title="No spending this month"
              description="Transactions you add will show up here by payment method."
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {methods.map((pm) => {
              const info = paymentMethodInfo(pm.payment_method);
              return (
                <div
                  key={pm.payment_method ?? "unspecified"}
                  className="rounded-[18px] border p-5"
                  style={{ backgroundColor: info.bg, borderColor: info.border }}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: info.bar }}
                    >
                      {info.emoji}
                    </div>
                    <span className="text-sm font-medium text-primary">{info.label}</span>
                  </div>
                  <AmountText amount={pm.display_amount} currency={currency} size="lg" />
                  <div className="flex items-center justify-between mt-2 text-xs text-secondary">
                    <span>
                      {pm.transaction_count} txn{pm.transaction_count === 1 ? "" : "s"}
                    </span>
                    <span className="tabular-nums">{Math.round(pm.percent_of_total)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Spending by payment method */}
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-primary mb-4">Spending by payment method</h2>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 bg-surface-hover rounded animate-pulse-soft" />
              ))}
            </div>
          ) : methods.length === 0 ? (
            <p className="text-sm text-secondary">No spending this month.</p>
          ) : (
            <div className="space-y-4">
              {methods.map((pm) => {
                const info = paymentMethodInfo(pm.payment_method);
                return (
                  <div key={pm.payment_method ?? "unspecified"} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-36 shrink-0">
                      <span className="text-base">{info.emoji}</span>
                      <span className="text-sm text-primary truncate">{info.label}</span>
                    </div>
                    <ProgressBar value={pm.percent_of_total} color={info.bar} className="flex-1" />
                    <AmountText
                      amount={pm.display_amount}
                      currency={currency}
                      size="sm"
                      className="w-24 text-right shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Net worth — no balance-history endpoint yet */}
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-primary">Net worth · last 6 months</h2>
          <p className="text-xs text-secondary mt-0.5 mb-4">Assets minus liabilities, over time.</p>
          <div className="flex items-center justify-center h-[120px] border-t border-divider">
            <button
              className="text-xs font-medium text-secondary border border-border rounded-full px-4 py-2 bg-surface-hover hover:bg-border transition-colors cursor-pointer"
              {...comingSoonProps("Net-worth history")}
            >
              View net-worth history
            </button>
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <h2 className="text-sm font-semibold text-primary mb-3">Recent activity</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-[10px] bg-surface-hover animate-pulse-soft shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-surface-hover rounded w-1/3 animate-pulse-soft" />
                    <div className="h-3 bg-surface-hover rounded w-1/4 animate-pulse-soft" />
                  </div>
                  <div className="h-4 bg-surface-hover rounded w-16 animate-pulse-soft" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-7 h-7" />}
              title="No recent activity"
              description="Transactions you add this month will show up here."
            />
          ) : (
            <div>
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} currency={currency} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
