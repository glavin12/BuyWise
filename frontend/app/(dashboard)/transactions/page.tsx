/**
 * Transactions — colorful cream reskin (see _Tx.dc.html)
 *
 * Dense table grouped by date with a per-day net subtotal. Row click (or the
 * hover pencil) opens inline edit; amount/category/date/description flow
 * through updateTransaction. Single-balance backend: no accounts/transfers —
 * payment_method replaces the old account column. Search is client-side over
 * the loaded page; scoped to the current month (mockup has no month switcher).
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Receipt, Pencil, Trash2, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { AmountText } from "@/components/ui/amount-text";
import { CategoryTag } from "@/components/ui/category-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, displayToMinor, minorToDisplay } from "@/lib/format";
import { categoryStyle, categoryEmoji, paymentMethodInfo } from "@/lib/categories";
import { comingSoonProps } from "@/lib/coming-soon";
import type { Transaction, Category, TransactionUpdate, MonthlySummary } from "@/lib/types";

const PAGE_SIZE = 20;
const VISIBLE_CATEGORIES = 4;

const isIncomeTx = (tx: Transaction) =>
  tx.transaction_type === "income" || tx.transaction_type === "starting_balance";

export default function TransactionsPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const today = now.toISOString().split("T")[0];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionUpdate>({});
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick add
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listTransactions({
        category_id: filterCategory || undefined,
        transaction_type: filterType || undefined,
        period: "this_month",
        limit: PAGE_SIZE,
        offset,
      });
      setTransactions(res.transactions);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCategory, offset]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reference data + this month's totals (fixed to current month — no switcher in the mockup)
  useEffect(() => {
    const load = async () => {
      const [catRes, summaryRes] = await Promise.allSettled([
        api.listCategories(),
        api.monthlyAnalytics(month, year),
      ]);
      if (catRes.status === "fulfilled") setCategories(catRes.value.categories);
      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditAmount(String(tx.display_amount));
    setEditForm({
      category_id: tx.category_id,
      transaction_type: tx.transaction_type,
      transaction_date: tx.transaction_date,
      description: tx.description ?? null,
      notes: tx.notes ?? null,
      cleared_status: tx.cleared_status,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const amountNum = parseFloat(editAmount);
      const update: TransactionUpdate = {
        ...editForm,
        ...(isNaN(amountNum) ? {} : { amount: displayToMinor(amountNum) }),
      };
      await api.updateTransaction(editingId, update);
      setEditingId(null);
      fetchTransactions();
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteTransaction(deleteId);
      setDeleteId(null);
      fetchTransactions();
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeleting(false);
    }
  };

  const currency = transactions[0]?.currency || "INR";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const activeCategories = categories.filter((c) => c.is_active);
  const visibleCategories = showAllCategories
    ? activeCategories
    : activeCategories.slice(0, VISIBLE_CATEGORIES);
  const hasFilters = !!(filterType || filterCategory || search.trim());

  // Client-side search over the loaded page (payee / description / notes)
  const q = search.trim().toLowerCase();
  const visible = q
    ? transactions.filter((tx) =>
        [tx.payee, tx.description, tx.notes].some((v) => v?.toLowerCase().includes(q))
      )
    : transactions;

  // Group by date, preserving fetch order; per-day net subtotal
  const groups: { date: string; label: string; weekday: string; net: number; rows: Transaction[] }[] = [];
  for (const tx of visible) {
    let group = groups.find((g) => g.date === tx.transaction_date);
    if (!group) {
      group = {
        date: tx.transaction_date,
        label: `${tx.transaction_date === today ? "Today · " : ""}${formatDate(tx.transaction_date, "short")}`,
        weekday: new Date(tx.transaction_date).toLocaleDateString("en-IN", { weekday: "short" }),
        net: 0,
        rows: [],
      };
      groups.push(group);
    }
    group.net += isIncomeTx(tx) ? tx.display_amount : -tx.display_amount;
    group.rows.push(tx);
  }

  // Windowed page numbers (max 5) around the current page
  let pageStart = Math.max(1, currentPage - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  pageStart = Math.max(1, pageEnd - 4);
  const pageNumbers = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-5 mb-6">
        <div>
          <h1 className="serif text-[44px] leading-none">Transactions</h1>
          <p className="text-sm text-secondary mt-1.5">
            {total} entries this month · {formatCurrency(minorToDisplay(summary?.expenses ?? 0), currency)} spent ·{" "}
            {formatCurrency(minorToDisplay(summary?.income ?? 0), currency)} in
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <FilterChip {...comingSoonProps("Sort")}>⇅ Sort</FilterChip>
          <FilterChip {...comingSoonProps("Export CSV")}>⤓ Export CSV</FilterChip>
          <FilterChip active onClick={() => setQuickAddOpen(true)}>
            + New
          </FilterChip>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterChip active={filterType === ""} onClick={() => { setFilterType(""); setOffset(0); }}>
          All
        </FilterChip>
        <FilterChip active={filterType === "expense"} onClick={() => { setFilterType("expense"); setOffset(0); }}>
          Expenses
        </FilterChip>
        <FilterChip active={filterType === "income"} onClick={() => { setFilterType("income"); setOffset(0); }}>
          Income
        </FilterChip>
        <span className="w-px h-5 bg-border mx-1" />
        {visibleCategories.map((c) => (
          <FilterChip
            key={c.id}
            active={filterCategory === c.id}
            onClick={() => { setFilterCategory(filterCategory === c.id ? "" : c.id); setOffset(0); }}
          >
            {categoryEmoji(c.name)} {c.name}
          </FilterChip>
        ))}
        {activeCategories.length > VISIBLE_CATEGORIES && (
          <FilterChip onClick={() => setShowAllCategories((v) => !v)}>
            {showAllCategories ? "− Less" : "+ More"}
          </FilterChip>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payee, note…"
          aria-label="Search transactions"
          className="ml-auto min-w-[180px] sm:min-w-[220px] rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Table */}
      <Card variant="flat">
        <div className="overflow-x-auto overflow-y-hidden rounded-[18px]">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div className="w-9 h-9 bg-surface-hover rounded-[10px] animate-pulse-soft" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-surface-hover rounded w-1/3 animate-pulse-soft" />
                    <div className="h-3 bg-surface-hover rounded w-1/5 animate-pulse-soft" />
                  </div>
                  <div className="h-4 bg-surface-hover rounded w-16 animate-pulse-soft" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-7 h-7" />}
              title="No transactions found"
              description={
                hasFilters
                  ? "Try adjusting your filters or search"
                  : "Add your first transaction with the + New button above"
              }
            />
          ) : (
            <div className="min-w-max">
              {/* Column header */}
              <div className="grid grid-cols-[90px_42px_minmax(160px,1fr)_160px_130px_130px] gap-3 px-5 py-3 bg-surface-hover text-[11px] uppercase tracking-[0.08em] text-secondary font-medium">
                <div>Date</div>
                <div />
                <div>Payee</div>
                <div>Category</div>
                <div>Payment method</div>
                <div className="text-right">Amount</div>
              </div>

              {groups.map((group) => (
                <div key={group.date}>
                  {/* Day header — net subtotal */}
                  <div className="flex items-baseline gap-3 px-5 pt-3.5 pb-2 bg-background">
                    <span className="text-[13px] font-semibold text-primary">{group.label}</span>
                    <span className="text-[11px] uppercase tracking-[0.06em] text-secondary">{group.weekday}</span>
                    <span className="ml-auto text-xs text-secondary tabular-nums">
                      Net {group.net < 0 ? "−" : "+"}
                      {formatCurrency(Math.abs(group.net), currency)}
                    </span>
                  </div>

                  {group.rows.map((tx) => {
                    const isIncome = isIncomeTx(tx);
                    const primary = tx.payee || tx.description || "Transaction";
                    const secondary = tx.notes || (tx.payee ? tx.description : "") || "";
                    const pm = paymentMethodInfo(tx.payment_method);

                    if (editingId === tx.id) {
                      return (
                        <div key={tx.id} className="mx-3 my-1.5 rounded-xl border border-primary/15 bg-surface-hover p-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-secondary">Amount</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-secondary">Category</label>
                              <select
                                value={editForm.category_id || ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value || null }))}
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                <option value="">None</option>
                                {activeCategories.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-secondary">Date</label>
                              <input
                                type="date"
                                value={editForm.transaction_date || ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, transaction_date: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-secondary">Description</label>
                              <input
                                type="text"
                                value={editForm.description || ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value || null }))}
                                className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={saveEdit} loading={saving}>
                              <Check className="w-3.5 h-3.5 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                            <button
                              onClick={() => { setEditingId(null); setDeleteId(tx.id); }}
                              className="ml-auto p-1.5 text-secondary hover:text-negative transition-colors cursor-pointer"
                              aria-label="Delete transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={tx.id}
                        onClick={() => startEdit(tx)}
                        className="group relative grid grid-cols-[90px_42px_minmax(160px,1fr)_160px_130px_130px] gap-3 items-center px-5 py-3 border-b border-divider last:border-0 cursor-pointer hover:bg-surface-hover transition-colors"
                      >
                        <span className="mono text-xs text-secondary">{formatDate(tx.transaction_date, "short")}</span>
                        <div
                          className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-base"
                          style={{ backgroundColor: categoryStyle(tx.category).bg }}
                        >
                          {tx.category_icon || categoryEmoji(tx.category)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{primary}</p>
                          {secondary && <p className="text-xs text-secondary truncate">{secondary}</p>}
                        </div>
                        <div>
                          {tx.category ? (
                            <CategoryTag name={tx.category} icon={tx.category_icon} />
                          ) : (
                            <span className="text-xs text-secondary">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-tertiary">
                          <span>{pm.emoji}</span>
                          {pm.label}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <AmountText
                            amount={tx.display_amount}
                            currency={tx.currency}
                            context={isIncome ? "income" : "neutral"}
                            sign={isIncome}
                            size="lg"
                          />
                        </div>

                        {/* Hover actions */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-surface-hover pl-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(tx); }}
                            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-border cursor-pointer"
                            aria-label="Edit transaction"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(tx.id); }}
                            className="p-1.5 rounded-md text-secondary hover:text-negative hover:bg-border cursor-pointer"
                            aria-label="Delete transaction"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-t border-divider text-xs text-secondary">
            <span>Showing {transactions.length} of {total}</span>
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              <FilterChip
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Prev
              </FilterChip>
              {pageNumbers.map((p) => (
                <FilterChip key={p} active={p === currentPage} onClick={() => setOffset((p - 1) * PAGE_SIZE)}>
                  {p}
                </FilterChip>
              ))}
              <FilterChip
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next ›
              </FilterChip>
            </div>
          </div>
        )}
      </Card>

      {/* Delete confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete transaction" size="sm">
        <p className="text-sm text-secondary mb-4">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setDeleteId(null)} className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Quick add — mockup's "+ New" chip */}
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={fetchTransactions} />
    </div>
  );
}
