/**
 * Budget — colorful-cream (see _Budget.dc.html).
 *
 * "Ready to assign" hero + income/assigned/spent summary, then a single
 * envelopes list (the backend has no category groups, so the mockup's named
 * groups collapse to one list). Budgeted amount is inline-editable; progress
 * bars use each category's colour.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { PiggyBank } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FilterChip } from "@/components/ui/filter-chip";
import { AmountText } from "@/components/ui/amount-text";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { InlineEditableField } from "@/components/ui/inline-editable-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatCurrency, displayToMinor } from "@/lib/format";
import { categoryStyle, categoryEmoji } from "@/lib/categories";
import { TRANSACTION_UPDATED_EVENT } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { Budget, Category, DashboardData } from "@/lib/types";

export default function BudgetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const period = isCurrentMonth ? "this_month" : "last_month";
  const currency = dashboard?.currency || "INR";

  // Backend /dashboard only accepts this_month/last_month, so the picker
  // can't be allowed to land on anything else — otherwise "Ready to assign"
  // mixes current-month budgets with a different month's income.
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

  const fetchData = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      try {
        const [budgetRes, catRes, dashRes] = await Promise.allSettled([
          api.getMonthBudgets(year, month),
          api.listCategories(),
          api.getDashboard(period),
        ]);
        if (budgetRes.status === "fulfilled") setBudgets(budgetRes.value.budgets);
        if (catRes.status === "fulfilled") setCategories(catRes.value.categories);
        if (dashRes.status === "fulfilled") setDashboard(dashRes.value);
      } catch (err) {
        console.error("Failed to load budget data:", err);
      } finally {
        setLoading(false);
      }
    },
    [month, year, period]
  );

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    const onTxUpdated = () => {
      fetchData(false);
    };
    window.addEventListener(TRANSACTION_UPDATED_EVENT, onTxUpdated);
    return () => window.removeEventListener(TRANSACTION_UPDATED_EVENT, onTxUpdated);
  }, [fetchData]);

  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id));
  const unbudgetedCategories = categories.filter(
    (c) => c.is_active && c.type === "expense" && !budgetedCategoryIds.has(c.id)
  );

  const totalBudgeted = budgets.reduce((s, b) => s + b.display_budgeted_amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.display_spent ?? 0), 0);
  const income = dashboard?.display_total_income ?? 0;
  const leftToBudget = income - totalBudgeted;

  const handleBudgetEdit = async (budgetId: string, newAmountStr: string) => {
    const num = parseFloat(newAmountStr);
    if (isNaN(num) || num < 0) return;
    const newMinor = displayToMinor(num);
    // Optimistically update local budget row to prevent UI flicker
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budgetId
          ? {
              ...b,
              budgeted_amount: newMinor,
              display_budgeted_amount: num,
              remaining_amount: newMinor - (b.spent ?? 0),
              display_remaining: num - (b.display_spent ?? 0),
              percent_used: num > 0 ? ((b.display_spent ?? 0) / num) * 100 : null,
            }
          : b
      )
    );
    try {
      await api.updateBudget(budgetId, { budgeted_amount: newMinor });
      fetchData(false);
    } catch (err) {
      console.error("Failed to update budget:", err);
      fetchData(false);
    }
  };

  const handleAdd = async () => {
    if (!addCategoryId || !addAmount) return;
    const num = parseFloat(addAmount);
    if (isNaN(num) || num <= 0) return;
    setSaving(true);
    try {
      await api.setBudget({
        category_id: addCategoryId,
        month,
        year,
        budgeted_amount: displayToMinor(num),
      });
      setShowAddModal(false);
      setAddCategoryId("");
      setAddAmount("");
      fetchData(false);
    } catch (err) {
      console.error("Failed to create budget:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLastMonth = async () => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    setCopying(true);
    try {
      const lastMonthRes = await api.getMonthBudgets(prevYear, prevMonth);
      for (const budget of lastMonthRes.budgets) {
        await api.setBudget({
          category_id: budget.category_id,
          month,
          year,
          budgeted_amount: budget.budgeted_amount,
        });
      }
      fetchData(false);
    } catch (err) {
      console.error("Failed to copy budgets:", err);
    } finally {
      setCopying(false);
    }
  };

  const handleDelete = async (budgetId: string) => {
    // Optimistically remove from state
    setBudgets((prev) => prev.filter((b) => b.id !== budgetId));
    try {
      await api.deleteBudget(budgetId);
      fetchData(false);
    } catch (err) {
      console.error("Failed to delete budget:", err);
      fetchData(false);
    }
  };

  const remainingColor = (remaining: number | null, percentUsed: number | null) => {
    if (remaining === null || percentUsed === null) return "text-secondary";
    if (remaining < 0) return "text-negative";
    if (percentUsed >= 90) return "text-warning";
    return "text-positive";
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="serif text-[40px] sm:text-[44px] leading-none">Budget</h1>
          <p className="text-sm text-secondary mt-1.5">
            Give every rupee a job. Assign until “Ready to assign” hits zero.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip onClick={handleCopyLastMonth} disabled={copying}>
            ⧉ {copying ? "Copying…" : "Copy from last month"}
          </FilterChip>
          <FilterChip
            active
            onClick={() => setShowAddModal(true)}
            disabled={unbudgetedCategories.length === 0}
          >
            + Set budget
          </FilterChip>
          <MonthSwitcher month={month} year={year} onChange={handleMonthChange} />
        </div>
      </div>

      {/* Ready-to-assign hero + summary */}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_1fr] mb-6">
        <div className="relative overflow-hidden rounded-[18px] bg-primary text-background p-6">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-[#F2C14E] opacity-20 pointer-events-none" />
          <p className="relative text-[11px] uppercase tracking-[0.1em] text-background/70">
            Ready to assign
          </p>
          <div className="relative mt-2">
            <AmountText
              amount={leftToBudget}
              currency={currency}
              size="hero"
              className={cn("text-[44px]", leftToBudget < 0 ? "!text-negative" : "!text-[#F2C14E]")}
            />
          </div>
          <p className="relative text-xs text-background/70 mt-2">
            {leftToBudget >= 0
              ? `${formatCurrency(leftToBudget, currency)} still needs a job.`
              : "You've assigned more than your income."}
          </p>
        </div>

        <Card className="bg-[#E9F5EE] border-[#C7E4D2]">
          <p className="text-[11px] uppercase tracking-[0.1em] text-positive">Income</p>
          <div className="mt-1">
            <AmountText amount={income} currency={currency} size="lg" />
          </div>
        </Card>
        <Card className="bg-[#FBF1D8] border-[#EAD9A6]">
          <p className="text-[11px] uppercase tracking-[0.1em] text-warning">Assigned</p>
          <div className="mt-1">
            <AmountText amount={totalBudgeted} currency={currency} size="lg" />
          </div>
        </Card>
        <Card className="bg-[#FCE9E5] border-[#F4C7BF]">
          <p className="text-[11px] uppercase tracking-[0.1em] text-negative">Spent so far</p>
          <div className="mt-1">
            <AmountText amount={totalSpent} currency={currency} size="lg" />
          </div>
        </Card>
      </div>

      {/* Envelopes */}
      <Card variant="flat" className="overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface-hover">
          <div className="w-7 h-7 rounded-[9px] bg-[#6FCF97] flex items-center justify-center text-sm">
            ◧
          </div>
          <div className="font-semibold text-[15px]">Envelopes</div>
          <div className="ml-2 text-xs text-secondary">{budgets.length} categories</div>
        </div>

        {loading ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-[10px] bg-surface-hover animate-pulse-soft" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 rounded bg-surface-hover animate-pulse-soft" />
                  <div className="h-2 w-full rounded bg-surface-hover animate-pulse-soft" />
                </div>
              </div>
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <EmptyState
            icon={<PiggyBank className="w-7 h-7" />}
            title="No budgets set for this month"
            description="Set category budgets to track your spending against targets."
            action={{ label: "Set your first budget", onClick: () => setShowAddModal(true) }}
          />
        ) : (
          <>
            {/* column header */}
            <div className="hidden sm:grid grid-cols-[28px_1fr_110px_110px_110px_1.4fr] gap-4 px-5 py-2.5 text-[11px] uppercase tracking-[0.08em] text-secondary border-b border-divider">
              <div />
              <div>Category</div>
              <div className="text-right">Assigned</div>
              <div className="text-right">Spent</div>
              <div className="text-right">Left</div>
              <div>Progress</div>
            </div>

            {budgets.map((b) => {
              const style = categoryStyle(b.category);
              return (
                <div
                  key={b.id}
                  className="grid grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_1fr_110px_110px_110px_1.4fr] gap-x-3 sm:gap-4 gap-y-2 px-5 py-3.5 items-center border-b border-divider last:border-0"
                >
                  <div
                    className="w-7 h-7 rounded-[9px] flex items-center justify-center text-sm"
                    style={{ backgroundColor: style.bg }}
                  >
                    {categoryEmoji(b.category)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {b.category || "Uncategorized"}
                    </div>
                  </div>

                  {/* Assigned (inline editable) */}
                  <div className="text-right sm:col-auto col-start-2">
                    <span className="sm:hidden text-[11px] text-secondary mr-1">Assigned</span>
                    <InlineEditableField
                      value={String(b.display_budgeted_amount)}
                      onSave={(val) => handleBudgetEdit(b.id, val)}
                      type="number"
                      prefix="₹"
                      className="justify-end"
                      displayClassName="text-sm font-medium text-primary"
                    />
                  </div>

                  {/* Spent */}
                  <div className="text-right text-sm text-tertiary tabular-nums col-start-2 sm:col-auto">
                    <span className="sm:hidden text-[11px] text-secondary mr-1">Spent</span>
                    {formatCurrency(b.display_spent ?? 0, currency)}
                  </div>

                  {/* Left */}
                  <div
                    className={cn(
                      "text-right text-sm font-semibold tabular-nums col-start-2 sm:col-auto",
                      remainingColor(b.display_remaining ?? null, b.percent_used)
                    )}
                  >
                    <span className="sm:hidden text-[11px] text-secondary mr-1 font-normal">Left</span>
                    {formatCurrency(b.display_remaining ?? 0, currency)}
                  </div>

                  {/* Progress + delete */}
                  <div className="flex items-center gap-2 col-span-3 sm:col-auto">
                    <ProgressBar
                      value={b.percent_used ?? 0}
                      color={style.bar}
                      overColor="#B93D28"
                      showLabel
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="p-1 text-secondary hover:text-negative transition-colors cursor-pointer"
                      title="Remove budget"
                      aria-label={`Remove ${b.category ?? "category"} budget`}
                    >
                      <span className="text-sm">×</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Card>

      {/* Add Budget Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Set category budget" size="sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-primary">Category</label>
            <select
              value={addCategoryId}
              onChange={(e) => setAddCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">Select category...</option>
              {unbudgetedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryEmoji(c.name)} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-primary">Budget amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-secondary serif">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-2.5 text-lg serif tabular-nums bg-surface border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <Button onClick={handleAdd} loading={saving} className="w-full">
            Set budget
          </Button>
        </div>
      </Modal>
    </div>
  );
}
