/**
 * Reports — "colorful cream" reskin (see _Reports.dc.html)
 *
 * One flowing report for the active month: income/spend trend bars, category
 * breakdown, month-over-month comparison, payment-method split, and a small
 * insights strip. The tab chips select visual focus, but every section pulls
 * from a real analytics endpoint and stays on screen together regardless of
 * which chip is active — matching the mockup, which renders all of it at once
 * under a single "Monthly" state. No per-tab fetch/hide.
 *
 * `comparisonAnalytics` only returns month-level {first, second, change} (no
 * per-category breakdown), so "This month vs. last" falls back to comparing
 * income/expenses/net for the two months instead of the mockup's per-category
 * rows — noted where it's built below.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AmountText } from "@/components/ui/amount-text";
import { FilterChip } from "@/components/ui/filter-chip";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { formatMonth } from "@/lib/format";
import { categoryStyle, categoryEmoji, paymentMethodInfo, HUES } from "@/lib/categories";
import { comingSoonProps } from "@/lib/coming-soon";
import type {
  MonthlySummary,
  CategorySpending,
  MonthComparison,
  PaymentMethodSpending,
} from "@/lib/types";

const REPORT_TABS = ["Monthly", "Categories", "Comparison"] as const;
const MONTHS_BACK = 6;
/** bars normalize to this % of the chart's height, not 100 — leaves headroom
 * inside the box for the value label so it never gets clipped. */
const BAR_MAX_PCT = 82;

/** Last `count` (month, year) pairs, oldest first, ending at (month, year). */
function lastMonths(month: number, year: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    let m = month - offset;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    return { m, y };
  });
}

type CompareRow = {
  key: "income" | "expenses" | "net";
  label: string;
  prevVal: number;
  currVal: number;
  color: string;
  badWhenUp: boolean;
};

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<string>("Monthly");
  const [loading, setLoading] = useState(true);

  const [history, setHistory] = useState<MonthlySummary[]>([]);
  const [categoryData, setCategoryData] = useState<CategorySpending[]>([]);
  const [comparison, setComparison] = useState<MonthComparison | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentMethodSpending[]>([]);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const monthsMeta = lastMonths(month, year, MONTHS_BACK);
      const [historyRes, catRes, cmpRes, pmRes] = await Promise.allSettled([
        Promise.all(
          monthsMeta.map(({ m, y }) =>
            api.monthlyAnalytics(m, y).catch(
              (): MonthlySummary => ({ month: m, year: y, income: 0, expenses: 0, net: 0 })
            )
          )
        ),
        api.categoryAnalytics(month, year),
        api.comparisonAnalytics(prevMonth, prevYear, month, year),
        api.paymentMethodAnalytics(month, year),
      ]);
      if (historyRes.status === "fulfilled") setHistory(historyRes.value);
      if (catRes.status === "fulfilled") setCategoryData(catRes.value);
      if (cmpRes.status === "fulfilled") setComparison(cmpRes.value);
      if (pmRes.status === "fulfilled") setPaymentData(pmRes.value);
    } catch (err) {
      console.error("Failed to load report data:", err);
    } finally {
      setLoading(false);
    }
  }, [month, year, prevMonth, prevYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monthly = history[history.length - 1] ?? null;

  // Savings rate — this month vs. the average of the fetched history
  const currentRate = monthly && monthly.income > 0 ? (monthly.net / monthly.income) * 100 : null;
  const historyRates = history.filter((h) => h.income > 0).map((h) => (h.net / h.income) * 100);
  const avgRate = historyRates.length
    ? historyRates.reduce((a, b) => a + b, 0) / historyRates.length
    : null;

  const subtitle =
    currentRate === null
      ? "Add income this month to see your savings rate."
      : currentRate >= 0
        ? `You saved ${Math.round(currentRate)}% of what you earned this month.`
        : `You spent ${Math.round(Math.abs(currentRate))}% more than you earned this month.`;

  // Bar chart normalization
  const maxVal = Math.max(1, ...history.flatMap((h) => [h.income, h.expenses]));
  const avgIncome = history.length
    ? history.reduce((s, h) => s + h.income, 0) / history.length / 100
    : 0;
  const avgExpenses = history.length
    ? history.reduce((s, h) => s + h.expenses, 0) / history.length / 100
    : 0;

  const topCategory = categoryData.length
    ? categoryData.reduce((a, b) => (b.display_amount > a.display_amount ? b : a))
    : null;
  const categoryTotal = categoryData.reduce((s, c) => s + c.display_amount, 0);

  // Comparison fallback — comparisonAnalytics has no category breakdown, so
  // compare the two months' income/expenses/net instead (see file header).
  const compareRows: CompareRow[] = comparison
    ? [
        { key: "income", label: "Income", prevVal: comparison.first.income, currVal: comparison.second.income, color: HUES.mint.bar, badWhenUp: false },
        { key: "expenses", label: "Expenses", prevVal: comparison.first.expenses, currVal: comparison.second.expenses, color: HUES.coral.bar, badWhenUp: true },
        { key: "net", label: "Net", prevVal: comparison.first.net, currVal: comparison.second.net, color: HUES.sky.bar, badWhenUp: false },
      ]
    : [];

  return (
    <div className="p-4 sm:p-5 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="serif text-[44px] leading-none">Reports</h1>
          <p className="text-sm text-secondary mt-1.5">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {REPORT_TABS.map((t) => (
            <FilterChip key={t} active={activeTab === t} onClick={() => setActiveTab(t)}>
              {t}
            </FilterChip>
          ))}
          <FilterChip {...comingSoonProps("Trends")}>Trends</FilterChip>
          <MonthSwitcher month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-5">
          <Card className="animate-pulse-soft">
            <div className="h-56 bg-surface-hover rounded-lg" />
          </Card>
          <div className="grid md:grid-cols-2 gap-5">
            <Card className="animate-pulse-soft"><div className="h-48 bg-surface-hover rounded-lg" /></Card>
            <Card className="animate-pulse-soft"><div className="h-48 bg-surface-hover rounded-lg" /></Card>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Income vs. spend */}
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-primary">
                  Income vs. spend · last {MONTHS_BACK} months
                </h2>
                <p className="text-xs text-secondary mt-0.5">Green = money in, coral = money out</p>
              </div>
              <div className="flex items-center gap-5 text-xs text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: HUES.mint.bar }} />
                  Income avg <AmountText amount={avgIncome} context="income" size="sm" className="font-semibold" />
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-[3px]" style={{ background: HUES.coral.bar }} />
                  Spend avg <AmountText amount={avgExpenses} context="status-negative" size="sm" className="font-semibold" />
                </span>
              </div>
            </div>

            {history.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="w-7 h-7" />}
                title="No history yet"
                description="Add transactions across a few months to see trends."
              />
            ) : (
              <div
                className="grid items-end gap-2 sm:gap-4 lg:gap-5 border-t border-divider pt-5 pb-1"
                style={{ gridTemplateColumns: `repeat(${history.length}, minmax(0, 1fr))`, height: 220 }}
              >
                {history.map((h) => {
                  const incPct = (h.income / maxVal) * BAR_MAX_PCT;
                  const expPct = (h.expenses / maxVal) * BAR_MAX_PCT;
                  return (
                    <div key={`${h.year}-${h.month}`} className="flex flex-col items-center h-full">
                      <div className="flex-1 flex items-end gap-1 sm:gap-1.5 w-full">
                        <div
                          className="flex-1 relative min-w-0"
                          style={{ height: `${incPct}%`, background: "linear-gradient(180deg,#6FCF97,#3E7A5A)", borderRadius: "8px 8px 3px 3px" }}
                        >
                          <AmountText
                            amount={h.income / 100}
                            context="income"
                            size="sm"
                            className="hidden sm:block absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px]!"
                          />
                        </div>
                        <div
                          className="flex-1 relative min-w-0"
                          style={{ height: `${expPct}%`, background: "linear-gradient(180deg,#FF6F5C,#B93D28)", borderRadius: "8px 8px 3px 3px" }}
                        >
                          <AmountText
                            amount={h.expenses / 100}
                            context="status-negative"
                            size="sm"
                            className="hidden sm:block absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px]!"
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-secondary">{formatMonth(h.month, h.year).slice(0, 3)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Categories + comparison */}
          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <h2 className="text-[15px] font-semibold text-primary mb-1">
                Where the money went · {formatMonth(month, year).split(" ")[0]}
              </h2>
              {categoryData.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 className="w-7 h-7" />}
                  title="No spending yet"
                  description="Add transactions to see your category breakdown."
                />
              ) : (
                <>
                  <p className="text-xs text-secondary mb-4">
                    <AmountText amount={categoryTotal} size="sm" className="font-semibold" /> across{" "}
                    {categoryData.length} categor{categoryData.length === 1 ? "y" : "ies"}
                  </p>
                  <div>
                    {categoryData.map((c) => (
                      <SpendRow
                        key={c.category_id}
                        tileBg={categoryStyle(c.category).bg}
                        emoji={categoryEmoji(c.category)}
                        name={c.category}
                        meta={`${c.transaction_count} txn${c.transaction_count !== 1 ? "s" : ""}`}
                        pct={c.percent_of_total}
                        barColor={categoryStyle(c.category).bar}
                        amount={c.display_amount}
                      />
                    ))}
                  </div>
                </>
              )}
            </Card>

            <Card>
              <h2 className="text-[15px] font-semibold text-primary mb-1">
                This month vs. {formatMonth(prevMonth, prevYear).split(" ")[0]}
              </h2>
              <p className="text-xs text-secondary mb-4">Income, expenses &amp; net vs. last month</p>
              {!comparison ? (
                <EmptyState
                  icon={<BarChart3 className="w-7 h-7" />}
                  title="Not enough data"
                  description="Comparison needs data from this month and last."
                />
              ) : (
                <div>
                  {compareRows.map((row) => {
                    const prevDisplay = row.prevVal / 100;
                    const currDisplay = row.currVal / 100;
                    const rowMax = Math.max(Math.abs(prevDisplay), Math.abs(currDisplay), 1);
                    const prevPct = (Math.abs(prevDisplay) / rowMax) * 100;
                    const currPct = (Math.abs(currDisplay) / rowMax) * 100;
                    const diff = comparison.change?.[row.key]?.percent_change ?? null;
                    const isPositive = (diff ?? 0) >= 0;
                    const isGood = row.badWhenUp ? !isPositive : isPositive;
                    return (
                      <div
                        key={row.key}
                        className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 sm:gap-3 items-center py-3 border-b border-divider last:border-0"
                      >
                        <span className="text-sm font-medium text-primary">{row.label}</span>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-1 h-3.5 rounded-full overflow-hidden" style={{ background: "#F0E6D2" }}>
                            <div className="h-full rounded-full" style={{ width: `${prevPct}%`, background: HUES.neutral.bar }} />
                          </div>
                          <AmountText amount={prevDisplay} size="sm" className="shrink-0 whitespace-nowrap text-secondary" />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <AmountText amount={currDisplay} size="sm" className="shrink-0 whitespace-nowrap" />
                          <div className="flex-1 h-3.5 rounded-full overflow-hidden" style={{ background: "#F0E6D2" }}>
                            <div className="h-full rounded-full" style={{ width: `${currPct}%`, background: row.color }} />
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold tabular-nums text-right whitespace-nowrap ${
                            diff === null ? "text-secondary" : isGood ? "text-positive" : "text-negative"
                          }`}
                        >
                          {diff === null ? "—" : `${isPositive ? "+" : "−"}${Math.abs(diff).toFixed(0)}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* By payment method — optional, nice-to-have */}
          {paymentData.length > 0 && (
            <Card>
              <h2 className="text-[15px] font-semibold text-primary mb-4">By payment method</h2>
              <div>
                {paymentData.map((p) => {
                  const info = paymentMethodInfo(p.payment_method);
                  return (
                    <SpendRow
                      key={p.payment_method ?? "unspecified"}
                      tileBg={info.bg}
                      emoji={info.emoji}
                      name={info.label}
                      meta={`${p.transaction_count} txn${p.transaction_count !== 1 ? "s" : ""}`}
                      pct={p.percent_of_total}
                      barColor={info.bar}
                      amount={p.display_amount}
                    />
                  );
                })}
              </div>
            </Card>
          )}

          {/* Insights strip */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[18px] p-5 border" style={{ background: HUES.mint.bg, borderColor: HUES.mint.border }}>
              <div className="text-2xl">🌱</div>
              <div className="font-semibold mt-2.5 text-primary">Savings rate</div>
              <p className="text-[13px] mt-1" style={{ color: HUES.mint.fg }}>
                {currentRate === null
                  ? "Add income this month to track how much you're keeping."
                  : avgRate === null || historyRates.length < 2
                    ? `${Math.round(currentRate)}% of income kept this month.`
                    : `${Math.round(currentRate)}% saved — ${Math.abs(Math.round(currentRate - avgRate))} points ${
                        currentRate >= avgRate ? "above" : "below"
                      } your ${MONTHS_BACK}-month average.`}
              </p>
            </div>

            <div className="rounded-[18px] p-5 border" style={{ background: HUES.amber.bg, borderColor: HUES.amber.border }}>
              <div className="text-2xl">{topCategory ? categoryEmoji(topCategory.category) : "🏷"}</div>
              <div className="font-semibold mt-2.5 text-primary">Top category</div>
              <p className="text-[13px] mt-1" style={{ color: HUES.amber.fg }}>
                {topCategory
                  ? `${topCategory.category} leads this month at ${topCategory.percent_of_total.toFixed(0)}% of spend.`
                  : "No spending yet this month."}
              </p>
            </div>

            <button
              {...comingSoonProps("Smart insights")}
              className="text-left rounded-[18px] p-5 border cursor-pointer"
              style={{ background: HUES.plum.bg, borderColor: HUES.plum.border }}
            >
              <div className="text-2xl">✦</div>
              <div className="font-semibold mt-2.5 text-primary">Smart insights</div>
              <p className="text-[13px] mt-1" style={{ color: HUES.plum.fg }}>
                Automatic alerts for one-off purchases and category trends.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared row shape for "Where the money went" and "By payment method": an
 * icon tile, name + share % + progress bar, and the amount. */
function SpendRow({
  tileBg,
  emoji,
  name,
  meta,
  pct,
  barColor,
  amount,
}: {
  tileBg: string;
  emoji: string;
  name: string;
  meta?: string;
  pct: number;
  barColor: string;
  amount: number;
}) {
  return (
    <div className="grid grid-cols-[32px_1fr_auto] gap-3 items-center py-2.5 border-b border-divider last:border-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: tileBg }}>
        {emoji}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-sm font-medium text-primary truncate">{name}</span>
          {meta && <span className="text-[11px] text-secondary whitespace-nowrap">{meta}</span>}
          <span className="ml-auto text-[11px] text-secondary tabular-nums whitespace-nowrap">{pct.toFixed(1)}%</span>
        </div>
        <ProgressBar value={pct} color={barColor} size="sm" />
      </div>
      <AmountText amount={amount} size="md" />
    </div>
  );
}
