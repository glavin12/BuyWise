/**
 * Transactions — DESIGN.md §5.2
 *
 * Single dense, sortable, filterable table. Row click → inline edit.
 * Transfers render as single logical row. Filter bar with date range,
 * account, category, type. All amounts right-aligned, tabular-nums,
 * neutral text (not red/green for every row).
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionRow } from "@/components/ui/transaction-row";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { AmountText } from "@/components/ui/amount-text";
import { api } from "@/lib/api";
import { formatCurrency, displayToMinor, formatDate } from "@/lib/format";
import type {
  Transaction,
  Account,
  Category,
  TransactionUpdate,
  TransactionType,
  ClearedStatus,
} from "@/lib/types";

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionUpdate>({});
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const period = isCurrentMonth ? "this_month" : undefined;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = period ? undefined : `${year}-${String(month).padStart(2, "0")}-01`;
      const dateTo = period
        ? undefined
        : `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;

      const res = await api.listTransactions({
        account_id: filterAccount || undefined,
        category_id: filterCategory || undefined,
        transaction_type: filterType || undefined,
        cleared_status: filterStatus || undefined,
        period: period || undefined,
        date_from: dateFrom,
        date_to: dateTo,
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
  }, [month, year, period, filterAccount, filterCategory, filterType, filterStatus, offset]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Load reference data
  useEffect(() => {
    const load = async () => {
      const [accRes, catRes] = await Promise.allSettled([
        api.listAccounts(),
        api.listCategories(),
      ]);
      if (accRes.status === "fulfilled") setAccounts(accRes.value.accounts);
      if (catRes.status === "fulfilled") setCategories(catRes.value.categories);
    };
    load();
  }, []);

  const handleMonthChange = (m: number, y: number) => {
    setMonth(m);
    setYear(y);
    setOffset(0);
  };

  // §5.2: Row click → inline edit
  const startEdit = (tx: Transaction) => {
    if (tx.transaction_type === "transfer") return; // Don't inline-edit transfers
    setEditingId(tx.id);
    setEditAmount(String(tx.display_amount));
    setEditForm({
      account_id: tx.account_id,
      category_id: tx.category_id,
      transaction_type: tx.transaction_type as TransactionType,
      transaction_date: tx.transaction_date,
      description: tx.description || "",
      notes: tx.notes || "",
      cleared_status: tx.cleared_status as ClearedStatus,
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
      // Check if it's a transfer
      const tx = transactions.find((t) => t.id === deleteId);
      if (tx?.transfer_group_id) {
        await api.deleteTransfer(tx.transfer_group_id);
      } else {
        await api.deleteTransaction(deleteId);
      }
      setDeleteId(null);
      fetchTransactions();
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const hasFilters = filterAccount || filterCategory || filterType || filterStatus;

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Transactions</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage your income and expenses
            </p>
          </div>
          <MonthSwitcher month={month} year={year} onChange={handleMonthChange} />
        </div>

        {/* Filter bar — §5.2 */}
        <Card className="mb-4 !p-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={filterAccount}
              onChange={(e) => { setFilterAccount(e.target.value); setOffset(0); }}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="">All Accounts</option>
              {accounts.filter((a) => a.is_active).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setOffset(0); }}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setOffset(0); }}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="cleared">Cleared</option>
            </select>

            {hasFilters && (
              <button
                onClick={() => {
                  setFilterAccount("");
                  setFilterCategory("");
                  setFilterType("");
                  setFilterStatus("");
                  setOffset(0);
                }}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}

            <div className="ml-auto text-xs text-zinc-600 self-center tabular-nums">
              {total > 0 && `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}
            </div>
          </div>
        </Card>

        {/* Transaction list */}
        <Card>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-zinc-800/50 last:border-0">
                  <div className="w-8 h-8 bg-zinc-800 rounded-lg animate-pulse-soft" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-zinc-800 rounded w-1/3 animate-pulse-soft" />
                    <div className="h-3 bg-zinc-800 rounded w-1/5 animate-pulse-soft" />
                  </div>
                  <div className="h-4 bg-zinc-800 rounded w-16 animate-pulse-soft" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-7 h-7" />}
              title="No transactions found"
              description={
                hasFilters
                  ? "Try adjusting your filters"
                  : "Add your first transaction using the button in the sidebar"
              }
            />
          ) : (
            <div>
              {transactions.map((tx) =>
                editingId === tx.id ? (
                  /* Inline edit row — §5.2 */
                  <div key={tx.id} className="py-3 px-3 -mx-3 bg-zinc-900/50 border border-emerald-500/20 rounded-lg my-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Category</label>
                        <select
                          value={editForm.category_id || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value || null }))}
                          className="w-full mt-1 px-2.5 py-1.5 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
                        >
                          <option value="">None</option>
                          {categories.filter((c) => c.is_active).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Date</label>
                        <input
                          type="date"
                          value={editForm.transaction_date || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, transaction_date: e.target.value }))}
                          className="w-full mt-1 px-2.5 py-1.5 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Description</label>
                        <input
                          type="text"
                          value={editForm.description || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          className="w-full mt-1 px-2.5 py-1.5 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                        className="ml-auto p-1.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={tx.id} className="group relative">
                    <TransactionRow
                      transaction={tx}
                      variant="full"
                      onClick={() => startEdit(tx)}
                    />
                    {/* Hover actions */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 pr-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(tx); }}
                        className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(tx.id); }}
                        className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-xs text-zinc-500 tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Transaction" size="sm">
        <p className="text-sm text-zinc-400 mb-4">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleDelete}
            loading={deleting}
            className="flex-1 !bg-red-500 hover:!bg-red-600"
          >
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setDeleteId(null)} className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
