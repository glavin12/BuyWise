/**
 * Reports — DESIGN.md §5.6
 *
 * Three tabs, one per backend endpoint:
 * 1. Monthly: income vs expense bar chart
 * 2. Categories: horizontal bar list (not donut — §5.6)
 * 3. Comparison: side-by-side bars per category
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { AmountText } from "@/components/ui/amount-text";
import { Tabs } from "@/components/ui/tabs";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { MonthlySummary, CategorySpending, MonthComparison } from "@/lib/types";

const REPORT_TABS = [
  { id: "monthly", label: "Monthly" },
  { id: "categories", label: "Categories" },
  { id: "comparison", label: "Comparison" },
];

const CATEGORY_COLORS = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444",
  "#06B6D4", "#EC4899", "#F97316", "#14B8A6", "#6366F1",
];

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState("monthly");
  const [loading, setLoading] = useState(true);

  // Data
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [categoryData, setCategoryData] = useState<CategorySpending[]>([]);
  const [comparison, setComparison] = useState<MonthComparison | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "monthly") {
        const res = await api.monthlyAnalytics(month, year);
        setMonthly(res);
      } else if (activeTab === "categories") {
        const res = await api.categoryAnalytics(month, year);
        setCategoryData(res);
      } else if (activeTab === "comparison") {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const res = await api.comparisonAnalytics(prevMonth, prevYear, month, year);
        setComparison(res);
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
    } finally {
      setLoading(false);
    }
  }, [month, year, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-zinc-400 mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm text-zinc-100 tabular-nums">
            <span style={{ color: entry.color }}>■</span> {entry.name}: {formatCurrency(entry.value / 100)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Reports</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Analyze your spending patterns
            </p>
          </div>
          <MonthSwitcher month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs tabs={REPORT_TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {loading ? (
          <Card className="animate-pulse-soft">
            <div className="h-72 bg-zinc-800 rounded-lg" />
          </Card>
        ) : (
          <>
            {/* Tab: Monthly */}
            {activeTab === "monthly" && monthly && (
              <div className="space-y-6">
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="!p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Income</span>
                    </div>
                    <AmountText amount={monthly.income / 100} context="income" size="md" />
                  </Card>
                  <Card className="!p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Expenses</span>
                    </div>
                    <AmountText amount={monthly.expenses / 100} context="neutral" size="md" />
                  </Card>
                  <Card className="!p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Transfers</span>
                    </div>
                    <AmountText amount={monthly.transfers / 100} context="neutral" size="md" />
                  </Card>
                  <Card className="!p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Net</span>
                    </div>
                    <AmountText amount={monthly.net / 100} context="balance" size="md" />
                  </Card>
                </div>

                {/* Bar chart */}
                <Card>
                  <h3 className="text-sm font-medium text-zinc-100 mb-4">Income vs Expenses</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        { name: "Income", value: monthly.income, fill: "#10B981" },
                        { name: "Expenses", value: monthly.expenses, fill: "#71717A" },
                        { name: "Net", value: monthly.net, fill: "#3B82F6" },
                      ]}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis dataKey="name" tick={{ fill: "#A1A1AA", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#A1A1AA", fontSize: 12 }} />
                      <Tooltip content={customTooltip} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* Tab: Categories — §5.6: horizontal bar list */}
            {activeTab === "categories" && (
              <Card>
                <h3 className="text-sm font-medium text-zinc-100 mb-4">Category Spending</h3>
                {categoryData.length === 0 ? (
                  <EmptyState
                    icon={<BarChart3 className="w-7 h-7" />}
                    title="No spending data"
                    description="Add some transactions to see your category breakdown."
                  />
                ) : (
                  <div className="space-y-3">
                    {categoryData.map((cat, i) => {
                      const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                      const maxAmount = categoryData[0]?.display_amount || 1;
                      const barWidth = (cat.display_amount / maxAmount) * 100;

                      return (
                        <div key={cat.category_id} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {cat.icon && <span className="text-sm">{cat.icon}</span>}
                              <span className="text-sm text-zinc-100">{cat.category}</span>
                              <span className="text-xs text-zinc-500 tabular-nums">
                                {cat.transaction_count} txn{cat.transaction_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-zinc-100 tabular-nums font-medium">
                                {formatCurrency(cat.display_amount)}
                              </span>
                              <span className="text-xs text-zinc-500 tabular-nums min-w-[40px] text-right">
                                {cat.percent_of_total.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          {/* Horizontal bar */}
                          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* Tab: Comparison — §5.6: side-by-side bars */}
            {activeTab === "comparison" && comparison && (
              <div className="space-y-6">
                <Card>
                  <h3 className="text-sm font-medium text-zinc-100 mb-4">
                    Month-over-Month Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        {
                          name: "Income",
                          prev: comparison.first.income,
                          current: comparison.second.income,
                        },
                        {
                          name: "Expenses",
                          prev: comparison.first.expenses,
                          current: comparison.second.expenses,
                        },
                        {
                          name: "Net",
                          prev: comparison.first.net,
                          current: comparison.second.net,
                        },
                      ]}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis dataKey="name" tick={{ fill: "#A1A1AA", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#A1A1AA", fontSize: 12 }} />
                      <Tooltip content={customTooltip} />
                      <Legend
                        formatter={(value: string) => (
                          <span className="text-xs text-zinc-400">{value}</span>
                        )}
                      />
                      <Bar dataKey="prev" name="Last Month" fill="#3F3F46" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="current" name="This Month" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Change summary */}
                {comparison.change && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(comparison.change).map(([key, change]) => {
                      const percentChange = change?.percent_change;
                      const isPositive = (percentChange ?? 0) >= 0;
                      return (
                        <Card key={key} className="!p-3">
                          <p className="text-xs text-zinc-500 uppercase tracking-wider capitalize mb-1">
                            {key}
                          </p>
                          <div className="flex items-center gap-2">
                            {percentChange !== null && percentChange !== undefined && (
                              <span
                                className={`text-sm font-medium tabular-nums ${
                                  key === "expenses"
                                    ? isPositive ? "text-red-400" : "text-emerald-400"
                                    : isPositive ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {isPositive ? "+" : ""}{percentChange.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
