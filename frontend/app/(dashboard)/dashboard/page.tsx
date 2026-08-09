"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Target,
  Wallet,
  Receipt,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Conversation, DashboardData, Goal, Transaction } from "@/lib/types";

function formatCurrency(amount: number, currency = "INR") {
  const locales: Record<string, string> = {
    INR: "en-IN",
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
  };
  try {
    return new Intl.NumberFormat(locales[currency] || "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

export default function DashboardPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [convData, dashData, goalsData, txData] = await Promise.allSettled([
          api.listConversations(5),
          api.getDashboard(),
          api.getGoals(),
          api.getTransactions(8),
        ]);
        if (convData.status === "fulfilled") setConversations(convData.value);
        if (dashData.status === "fulfilled") setDashboard(dashData.value);
        if (goalsData.status === "fulfilled") setGoals(goalsData.value.goals);
        if (txData.status === "fulfilled") setTransactions(txData.value.transactions);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const currency = dashboard?.currency || "INR";
  const remainingLabel = dashboard
    ? dashboard.has_plan
      ? "Planned Remaining"
      : "Logged Savings"
    : "Remaining";
  const remainingValue = dashboard?.has_plan
    ? dashboard.current_balance
    : dashboard?.actual_savings ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary">
            Dashboard
          </h1>
          <p className="text-sm text-muted mt-1">
            Your financial overview at a glance
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Wallet className="w-5 h-5" />}
            label={remainingLabel}
            value={loading ? null : formatCurrency(remainingValue, currency)}
            color="text-accent"
            bg="bg-accent/10"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Income"
            value={loading ? null : formatCurrency(dashboard?.total_income_received ?? 0, currency)}
            color="text-success"
            bg="bg-success/10"
          />
          <StatCard
            icon={<TrendingDown className="w-5 h-5" />}
            label="Spent"
            value={loading ? null : formatCurrency(dashboard?.total_spent ?? 0, currency)}
            color="text-error"
            bg="bg-error/10"
          />
          <StatCard
            icon={<PiggyBank className="w-5 h-5" />}
            label="Savings"
            value={loading ? null : formatCurrency(dashboard?.actual_savings ?? 0, currency)}
            color="text-warning"
            bg="bg-warning/10"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Goals */}
          <Card className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" />
                Goals
              </h2>
              <span className="text-xs text-muted">
                {goals.length} active
              </span>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-surface-hover rounded w-3/4 animate-pulse-soft" />
                    <div className="h-2 bg-surface-hover rounded animate-pulse-soft" />
                  </div>
                ))}
              </div>
            ) : goals.length === 0 ? (
              <div className="text-center py-6">
                <Target className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">No goals yet</p>
                <p className="text-xs text-muted mt-1">
                  Ask the AI to set a financial goal
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.slice(0, 4).map((goal) => (
                  <GoalItem key={goal.id} goal={goal} currency={currency} />
                ))}
              </div>
            )}
          </Card>

          {/* Transactions */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary flex items-center gap-2">
                <Receipt className="w-4 h-4 text-accent" />
                Recent Transactions
              </h2>
              <span className="text-xs text-muted">
                {transactions.length} recent
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-surface-hover rounded-lg animate-pulse-soft" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-surface-hover rounded w-1/3 animate-pulse-soft" />
                      <div className="h-3 bg-surface-hover rounded w-1/4 animate-pulse-soft" />
                    </div>
                    <div className="h-4 bg-surface-hover rounded w-16 animate-pulse-soft" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6">
                <Receipt className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">No transactions yet</p>
                <p className="text-xs text-muted mt-1">
                  Try the AI chat to add transactions
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <TransactionItem key={tx.id} tx={tx} currency={currency} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Conversations */}
        <Card className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-primary flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              Recent Conversations
            </h2>
            <Link href="/chat">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-surface-hover rounded-lg animate-pulse-soft" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-6">
              <MessageSquare className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted mb-3">No conversations yet</p>
              <Link href="/chat">
                <Button size="sm">Start a Chat</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/30 hover:bg-surface-hover transition-all duration-200 group"
                >
                  <MessageSquare className="w-4 h-4 text-muted flex-shrink-0 group-hover:text-accent transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {conv.title || "New conversation"}
                    </p>
                    <p className="text-xs text-muted">
                      {conv.message_count} messages
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
          <span className={color}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          {value === null ? (
            <div className="h-6 bg-surface-hover rounded w-24 animate-pulse-soft mt-0.5" />
          ) : (
            <p className="text-lg font-semibold text-primary truncate">{value}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function GoalItem({ goal, currency }: { goal: Goal; currency: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-primary truncate">{goal.title}</p>
        <span className="text-xs text-accent font-medium">{goal.progress_percent}%</span>
      </div>
      <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${Math.min(goal.progress_percent, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{formatCurrency(goal.current_amount, currency)}</span>
        <span>{formatCurrency(goal.target_amount, currency)}</span>
      </div>
    </div>
  );
}

function TransactionItem({ tx, currency }: { tx: Transaction; currency: string }) {
  const isExpense = tx.type === "expense";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
        isExpense ? "bg-error/10 text-error" : "bg-success/10 text-success"
      }`}>
        {isExpense ? (
          <ArrowDownRight className="w-4 h-4" />
        ) : (
          <ArrowUpRight className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{tx.title}</p>
        <p className="text-xs text-muted">
          {tx.category || "Uncategorized"}
          {tx.merchant_name ? ` \u00B7 ${tx.merchant_name}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${isExpense ? "text-error" : "text-success"}`}>
          {isExpense ? "-" : "+"}{formatCurrency(tx.amount, currency)}
        </p>
        {tx.transaction_date && (
          <p className="text-xs text-muted">
            {new Date(tx.transaction_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
