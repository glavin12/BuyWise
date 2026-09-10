/**
 * QuickAddModal — DESIGN.md §5.3
 *
 * "The highest-leverage component in the app."
 *
 * Global modal, available from anywhere. Tab order: Amount → Payee → Category →
 * Account → Date → Type. Enter submits and reopens blank. Esc closes.
 * Amount accepts plain numbers, converts to minor units only at submit.
 * Transfer mode swaps Category for "To account" field.
 */
"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { displayToMinor } from "@/lib/format";
import type {
  Account,
  Category,
  Payee,
  TransactionType,
} from "@/lib/types";

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

type QuickAddType = "expense" | "income" | "transfer";

const INITIAL_FORM = {
  amount: "",
  payee: "",
  category_id: "",
  account_id: "",
  to_account_id: "",
  date: new Date().toISOString().split("T")[0],
  description: "",
  type: "expense" as QuickAddType,
};

export function QuickAddModal({ open, onClose, onAdded }: QuickAddModalProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [payeeSearch, setPayeeSearch] = useState("");
  const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [accRes, catRes, payRes] = await Promise.allSettled([
        api.listAccounts(),
        api.listCategories(),
        api.listPayees(),
      ]);
      if (accRes.status === "fulfilled") {
        setAccounts(accRes.value.accounts);
        // Auto-select first active account if none chosen
        const active = accRes.value.accounts.filter((a: Account) => a.is_active);
        if (active.length > 0 && !form.account_id) {
          setForm((f) => ({ ...f, account_id: active[0].id }));
        }
      }
      if (catRes.status === "fulfilled") setCategories(catRes.value.categories);
      if (payRes.status === "fulfilled") setPayees(payRes.value.payees);
    };
    load();
  }, [open]);

  // Focus amount field when modal opens
  useEffect(() => {
    if (open && amountRef.current) {
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [open]);

  const resetForm = useCallback(() => {
    setForm({
      ...INITIAL_FORM,
      date: new Date().toISOString().split("T")[0],
      account_id: form.account_id, // Keep the last-used account
    });
    setPayeeSearch("");
    setError(null);
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [form.account_id]);

  const handleSubmit = async (reopenAfter = false) => {
    setError(null);

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }

    // Auto-fallback to first active account if none selected
    const effectiveAccountId = form.account_id || accounts.find((a) => a.is_active)?.id;
    if (!effectiveAccountId) {
      setError("No active accounts — create one first");
      return;
    }

    setSaving(true);

    try {
      if (form.type === "transfer") {
        if (!form.to_account_id) {
          setError("Select a destination account");
          setSaving(false);
          return;
        }
        await api.createTransfer({
          from_account_id: effectiveAccountId,
          to_account_id: form.to_account_id,
          amount: displayToMinor(amountNum),
          transaction_date: form.date,
          description: form.description || undefined,
        });
      } else {
        // Find or reference payee
        let payee_id: string | undefined;
        let payee_name: string | undefined;
        if (payeeSearch) {
          const existing = payees.find(
            (p) => p.name.toLowerCase() === payeeSearch.toLowerCase()
          );
          if (existing) {
            payee_id = existing.id;
          } else {
            payee_name = payeeSearch;
          }
        }

        await api.createTransaction({
          account_id: effectiveAccountId,
          category_id: form.category_id || undefined,
          payee_id,
          payee_name,
          amount: displayToMinor(amountNum),
          transaction_type: form.type as TransactionType,
          transaction_date: form.date,
          description: form.description || undefined,
          cleared_status: "pending",
        });
      }

      onAdded?.();

      if (reopenAfter) {
        resetForm();
      } else {
        resetForm();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(true); // Enter submits and reopens blank per §5.3
    }
  };

  const filteredPayees = payees.filter((p) =>
    p.name.toLowerCase().includes(payeeSearch.toLowerCase())
  );

  const filteredCategories =
    form.type === "expense"
      ? categories.filter((c) => c.type === "expense")
      : form.type === "income"
        ? categories.filter((c) => c.type === "income")
        : [];

  const typeOptions: { value: QuickAddType; label: string }[] = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
    { value: "transfer", label: "Transfer" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction" size="md">
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Type toggle */}
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: opt.value, category_id: "" }))}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                form.type === opt.value
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Amount — first in tab order per §5.3 */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-100">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              ₹
            </span>
            <input
              ref={amountRef}
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full pl-8 pr-3.5 py-2.5 text-lg font-semibold tabular-nums bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Payee — autocomplete per §5.3 */}
        {form.type !== "transfer" && (
          <div className="space-y-1.5 relative">
            <label className="block text-sm font-medium text-zinc-100">
              Payee
            </label>
            <input
              type="text"
              value={payeeSearch}
              onChange={(e) => {
                setPayeeSearch(e.target.value);
                setShowPayeeSuggestions(true);
              }}
              onFocus={() => setShowPayeeSuggestions(true)}
              onBlur={() => setTimeout(() => setShowPayeeSuggestions(false), 200)}
              placeholder="Type to search or add new..."
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
            {showPayeeSuggestions && payeeSearch && filteredPayees.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-36 overflow-y-auto">
                {filteredPayees.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setPayeeSearch(p.name);
                      setShowPayeeSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category (or To Account for transfers) — per §5.3 */}
        {form.type === "transfer" ? (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">
              To Account
            </label>
            <select
              value={form.to_account_id}
              onChange={(e) => setForm((f) => ({ ...f, to_account_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="">Select account...</option>
              {accounts
                .filter((a) => a.id !== form.account_id && a.is_active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">
              Category
            </label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="">No category</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Account (From) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-100">
            {form.type === "transfer" ? "From Account" : "Account"}
          </label>
          <select
            value={form.account_id}
            onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all cursor-pointer"
          >
            <option value="">Select account...</option>
            {accounts
              .filter((a) => a.is_active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-100">
            Date
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all cursor-pointer"
          />
        </div>

        {/* Description (optional) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-100">
            Note <span className="text-zinc-600 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Add a note..."
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => handleSubmit(false)}
            loading={saving}
            className="flex-1"
          >
            Save
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            loading={saving}
            variant="secondary"
            className="flex-1"
          >
            Save & Add Another
          </Button>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 text-[10px]">Enter</kbd> to save & add another · <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 text-[10px]">Esc</kbd> to close
        </p>
      </div>
    </Modal>
  );
}
