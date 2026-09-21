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
 *
 * Category and Payee are both predefined + user-created, and Payee is scoped
 * to the current transaction type (expense/income keep separate payee lists —
 * switching type clears any payee picked under the other type).
 */
"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { api } from "@/lib/api";
import { displayToMinor } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS, categoryEmoji } from "@/lib/categories";
import { emitTransactionUpdated } from "@/lib/events";
import type { Category, Payee, PaymentMethod, TransactionType } from "@/lib/types";

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

type QuickAddType = "expense" | "income";

const INITIAL_FORM = {
  amount: "",
  payee_id: "",
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
  const [refDataLoading, setRefDataLoading] = useState(false);
  const [refDataError, setRefDataError] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingPayee, setCreatingPayee] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const loadReferenceData = useCallback(async () => {
    setRefDataLoading(true);
    setRefDataError(null);
    const [catRes, payRes] = await Promise.allSettled([api.listCategories(), api.listPayees()]);
    if (catRes.status === "fulfilled") setCategories(catRes.value.categories);
    if (payRes.status === "fulfilled") setPayees(payRes.value.payees);
    if (catRes.status === "rejected" || payRes.status === "rejected") {
      setRefDataError("Couldn't load categories/payees.");
    }
    setRefDataLoading(false);
  }, []);

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return;
    loadReferenceData();
  }, [open, loadReferenceData]);

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

    if (!form.category_id) {
      setError("Pick a category");
      return;
    }

    setSaving(true);
    try {
      await api.createTransaction({
        category_id: form.category_id,
        payee_id: form.payee_id || undefined,
        amount: displayToMinor(amountNum),
        transaction_type: form.type as TransactionType,
        payment_method: form.payment_method || undefined,
        transaction_date: form.date,
        description: form.description || undefined,
        cleared_status: "pending",
      });

      emitTransactionUpdated();
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

  const switchType = (type: QuickAddType) => {
    // Category AND payee are type-scoped — stale picks from the other type
    // (e.g. an income source left selected after flipping to Expense) must not
    // carry over.
    setForm((f) => ({ ...f, type, category_id: "", payee_id: "" }));
  };

  const createCategory = async (name: string) => {
    setCreatingCategory(true);
    setError(null);
    try {
      const created = await api.createCategory({ name, type: form.type });
      setCategories((c) => (c.some((x) => x.id === created.id) ? c : [...c, created]));
      setForm((f) => ({ ...f, category_id: created.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const createPayee = async (name: string) => {
    setCreatingPayee(true);
    setError(null);
    try {
      const created = await api.createPayee({ name, type: form.type });
      setPayees((p) => (p.some((x) => x.id === created.id) ? p : [...p, created]));
      setForm((f) => ({ ...f, payee_id: created.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add payee");
    } finally {
      setCreatingPayee(false);
    }
  };

  const filteredCategories = categories.filter((c) => c.is_active && c.type === form.type);
  const filteredPayees = payees.filter((p) => p.type === form.type);

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
              onClick={() => switchType(opt.value)}
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
        <Combobox
          label={<>Payee <span className="text-secondary font-normal">(optional)</span></>}
          placeholder={`Select a${form.type === "expense" ? "n" : ""} ${form.type} payee`}
          searchPlaceholder="Search or add a payee..."
          value={form.payee_id}
          onChange={(payee_id) => setForm((f) => ({ ...f, payee_id }))}
          options={filteredPayees.map((p) => ({ value: p.id, label: p.name }))}
          loading={refDataLoading}
          error={refDataError}
          onRetry={loadReferenceData}
          emptyMessage="No payees yet — type a name to add one"
          onCreate={createPayee}
          creating={creatingPayee}
          createLabel={(q) => `+ Add new payee "${q}"`}
        />

        {/* Category */}
        <Combobox
          label={<>Category <span className="text-secondary font-normal">(Required)</span></>}
          placeholder="Select a category"
          searchPlaceholder="Search or add a category..."
          value={form.category_id}
          onChange={(category_id) => setForm((f) => ({ ...f, category_id }))}
          options={filteredCategories.map((c) => ({
            value: c.id,
            label: c.name,
            icon: categoryEmoji(c.name),
          }))}
          loading={refDataLoading}
          error={refDataError}
          onRetry={loadReferenceData}
          emptyMessage="No categories yet — type a name to add one"
          onCreate={createCategory}
          creating={creatingCategory}
          createLabel={(q) => `+ Add new category "${q}"`}
        />

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
