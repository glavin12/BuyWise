/**
 * QuickAddModal — DESIGN.md §5.3
 *
 * "The highest-leverage component in the app."
 *
 * Global modal, available from anywhere. Tab order: Amount → Payee → Category →
 * Payment method → Date → Type. Enter submits and reopens blank. Esc closes.
 * Amount accepts plain numbers, converts to minor units only at submit.
 *
 * Single-balance backend: no account selector. Each transaction is optionally
 * tagged with a payment method (cash/upi/card/bank_transfer/other).
 */
"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { displayToMinor } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS, categoryEmoji } from "@/lib/categories";
import type { Category, Payee, PaymentMethod, TransactionType } from "@/lib/types";

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

type QuickAddType = "expense" | "income";

const INITIAL_FORM = {
  amount: "",
  payee: "",
  category_id: "",
  payment_method: "" as "" | PaymentMethod,
  date: new Date().toISOString().split("T")[0],
  description: "",
  type: "expense" as QuickAddType,
};

const inputClass =
  "w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all";

export function QuickAddModal({ open, onClose, onAdded }: QuickAddModalProps) {
  const [form, setForm] = useState(INITIAL_FORM);
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
      const [catRes, payRes] = await Promise.allSettled([
        api.listCategories(),
        api.listPayees(),
      ]);
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
    setForm((f) => ({
      ...INITIAL_FORM,
      date: new Date().toISOString().split("T")[0],
      payment_method: f.payment_method, // keep last-used method
      type: f.type,
    }));
    setPayeeSearch("");
    setError(null);
    setTimeout(() => amountRef.current?.focus(), 50);
  }, []);

  const handleSubmit = async (reopenAfter = false) => {
    setError(null);

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      // Find or reference payee
      let payee_id: string | undefined;
      let payee_name: string | undefined;
      if (payeeSearch) {
        const existing = payees.find(
          (p) => p.name.toLowerCase() === payeeSearch.toLowerCase()
        );
        if (existing) payee_id = existing.id;
        else payee_name = payeeSearch;
      }

      await api.createTransaction({
        category_id: form.category_id || undefined,
        payee_id,
        payee_name,
        amount: displayToMinor(amountNum),
        transaction_type: form.type as TransactionType,
        payment_method: form.payment_method || undefined,
        transaction_date: form.date,
        description: form.description || undefined,
        cleared_status: "pending",
      });

      onAdded?.();
      resetForm();
      if (!reopenAfter) onClose();
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

  const filteredCategories = categories.filter((c) => c.type === form.type);

  const typeOptions: { value: QuickAddType; label: string }[] = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Add transaction" size="md">
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Type toggle */}
        <div className="flex gap-1 bg-surface-hover rounded-xl p-1 border border-border">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: opt.value, category_id: "" }))}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                form.type === opt.value
                  ? "bg-primary text-background"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-primary">Amount</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-secondary serif">
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
              className={`${inputClass} pl-8 !text-lg serif tabular-nums`}
            />
          </div>
        </div>

        {/* Payee */}
        <div className="space-y-1.5 relative">
          <label className="block text-sm font-medium text-primary">Payee</label>
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
            className={inputClass}
          />
          {showPayeeSuggestions && payeeSearch && filteredPayees.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-surface border border-border rounded-xl shadow-lg max-h-36 overflow-y-auto">
              {filteredPayees.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setPayeeSearch(p.name);
                    setShowPayeeSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-surface-hover cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-primary">Category</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">No category</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryEmoji(c.name)} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Payment method */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-primary">
            Payment method <span className="text-secondary font-normal">(optional)</span>
          </label>
          <select
            value={form.payment_method}
            onChange={(e) =>
              setForm((f) => ({ ...f, payment_method: e.target.value as "" | PaymentMethod }))
            }
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">Unspecified</option>
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.emoji} {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-primary">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className={`${inputClass} cursor-pointer`}
          />
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-primary">
            Note <span className="text-secondary font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Add a note..."
            className={inputClass}
          />
        </div>

        {error && (
          <div className="p-3 bg-[#FCE9E5] border border-[#F4C7BF] rounded-xl">
            <p className="text-sm text-negative">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={() => handleSubmit(false)} loading={saving} className="flex-1">
            Save
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            loading={saving}
            variant="secondary"
            className="flex-1"
          >
            Save &amp; add another
          </Button>
        </div>

        <p className="text-xs text-secondary text-center">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-hover rounded text-secondary text-[10px]">Enter</kbd>{" "}
          to save &amp; add another ·{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-hover rounded text-secondary text-[10px]">Esc</kbd>{" "}
          to close
        </p>
      </div>
    </Modal>
  );
}
