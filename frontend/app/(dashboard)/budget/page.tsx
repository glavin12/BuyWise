/**
 * Budget — DESIGN.md §5.4
 *
 * YNAB-inspired screen. Categories grouped, each row: name, budgeted
 * (inline-editable), spent, remaining. Remaining goes amber near zero,
 * red if over-budget. Header total: "Left to Budget" (income - all assigned)
 * updates live. "Copy last month's budget" action.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PiggyBank,
  Plus,
  Copy,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmountText } from "@/components/ui/amount-text";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { InlineEditableField } from "@/components/ui/inline-editable-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { formatCurrency, displayToMinor, minorToDisplay } from "@/lib/format";
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const period = isCurrentMonth ? "this_month" : "last_month";
  const currency = dashboard?.currency || "INR";

  const fetchData = useCallback(async () => {
    setLoading(true);
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
  }, [month, year, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Categories that don't have a budget yet
  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id));
  const unbudgetedCategories = categories.filter(
    (c) => c.is_active && c.type === "expense" && !budgetedCategoryIds.has(c.id)
  );

  // Totals
  const totalBudgeted = budgets.reduce((s, b) => s + b.display_budgeted_amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.display_spent ?? 0), 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const income = dashboard?.display_total_income ?? 0;
  const leftToBudget = income - totalBudgeted;

  // Group budgets by category type (we can use category lookup to figure groupings)
  // For now, show all as one flat list since the backend doesn't return group info
  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // Inline edit budget amount
  const handleBudgetEdit = async (budgetId: string, newAmountStr: string) => {
    const num = parseFloat(newAmountStr);
    if (isNaN(num) || num < 0) return;
    try {
      await api.updateBudget(budgetId, {
        budgeted_amount: displayToMinor(num),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to update budget:", err);
    }
  };

  // Create new budget
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
      fetchData();
    } catch (err) {
      console.error("Failed to create budget:", err);
    } finally {
      setSaving(false);
    }
  };

  // Copy last month's budgets
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
      fetchData();
    } catch (err) {
      console.error("Failed to copy budgets:", err);
    } finally {
      setCopying(false);
    }
  };

  // Delete budget
  const handleDelete = async (budgetId: string) => {
    try {
      await api.deleteBudget(budgetId);
      fetchData();
    } catch (err) {
      console.error("Failed to delete budget:", err);
    }
  };

  const getRemainingColor = (remaining: number | null, percentUsed: number | null) => {
    if (remaining === null || percentUsed === null) return "text-zinc-400";
    if (remaining < 0) return "text-red-400";
    if ((percentUsed) >= 75) return "text-amber-400";
    return "text-emerald-400";
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Budget</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Give every rupee a job
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthSwitcher month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          </div>
        </div>

        {/* §5.4: "Left to Budget" header — updates live */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="!p-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Income</p>
            <AmountText amount={income} currency={currency} context="income" size="md" />
          </Card>
          <Card className="!p-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Budgeted</p>
            <AmountText amount={totalBudgeted} currency={currency} context="neutral" size="md" />
          </Card>
          <Card className="!p-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Spent</p>
            <AmountText amount={totalSpent} currency={currency} context="neutral" size="md" />
          </Card>
          <Card className="!p-3 border-emerald-500/20">
            <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-medium">
              Left to Budget
            </p>
            <AmountText
              amount={leftToBudget}
              currency={currency}
              context={leftToBudget < 0 ? "status-negative" : "status-positive"}
              size="md"
            />
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mb-4">
          <Button size="sm" onClick={() => setShowAddModal(true)} disabled={unbudgetedCategories.length === 0}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Set Budget
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCopyLastMonth} loading={copying}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy Last Month
          </Button>
        </div>

        {/* Budget list */}
        <Card>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-zinc-800/50 last:border-0">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-1/3 animate-pulse-soft" />
                    <div className="h-2 bg-zinc-800 rounded w-full animate-pulse-soft" />
                  </div>
                  <div className="h-4 bg-zinc-800 rounded w-16 animate-pulse-soft" />
                </div>
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={<PiggyBank className="w-7 h-7" />}
              title="No budgets set for this month"
              description="Set category budgets to track your spending against targets."
              action={{
                label: "Set your first budget",
                onClick: () => setShowAddModal(true),
              }}
            />
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-12 gap-3 py-2 text-[10px] text-zinc-500 uppercase tracking-wider">
                <div className="col-span-4">Category</div>
                <div className="col-span-2 text-right">Budgeted</div>
                <div className="col-span-2 text-right">Spent</div>
                <div className="col-span-2 text-right">Remaining</div>
                <div className="col-span-2">Progress</div>
              </div>

              {budgets.map((b) => (
                <div
                  key={b.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 py-3 sm:items-center"
                >
                  {/* Category name */}
                  <div className="sm:col-span-4 flex items-center gap-2">
                    <span className="text-sm text-zinc-100 font-medium truncate">
                      {b.category || "Uncategorized"}
                    </span>
                  </div>

                  {/* Budgeted — inline editable per §5.4 */}
                  <div className="sm:col-span-2 text-right">
                    <InlineEditableField
                      value={String(b.display_budgeted_amount)}
                      onSave={(val) => handleBudgetEdit(b.id, val)}
                      type="number"
                      prefix="₹"
                      className="justify-end"
                      displayClassName="text-sm text-zinc-100 tabular-nums"
                    />
                  </div>

                  {/* Spent */}
                  <div className="sm:col-span-2 text-right">
                    <span className="text-sm text-zinc-400 tabular-nums">
                      {formatCurrency(b.display_spent ?? 0, currency)}
                    </span>
                  </div>

                  {/* Remaining — color per §4 */}
                  <div className="sm:col-span-2 text-right">
                    <span className={`text-sm font-medium tabular-nums ${getRemainingColor(b.display_remaining ?? null, b.percent_used)}`}>
                      {formatCurrency(b.display_remaining ?? 0, currency)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <ProgressBar value={b.percent_used ?? 0} size="sm" showLabel className="flex-1" />
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Remove budget"
                    >
                      <span className="text-xs">×</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Add Budget Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Set Category Budget" size="sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Category</label>
            <select
              value={addCategoryId}
              onChange={(e) => setAddCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="">Select category...</option>
              {unbudgetedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Budget Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
          <Button onClick={handleAdd} loading={saving} className="w-full">
            Set Budget
          </Button>
        </div>
      </Modal>
    </div>
  );
}
