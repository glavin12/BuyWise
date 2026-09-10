/**
 * Accounts — DESIGN.md §5.5
 *
 * CRUD-on-a-list: name, type, current balance (computed), active toggle.
 * Deactivating (not deleting) is the primary "remove" action.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Landmark,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Banknote,
  CreditCard,
  Building2,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { displayToMinor } from "@/lib/format";
import type { Account, AccountType } from "@/lib/types";

const ACCOUNT_TYPE_CONFIG: Record<
  AccountType,
  { label: string; icon: React.ReactNode; variant: "info" | "success" | "warning" | "default" }
> = {
  cash: { label: "Cash", icon: <Banknote className="w-4 h-4" />, variant: "success" },
  savings: { label: "Savings", icon: <Building2 className="w-4 h-4" />, variant: "info" },
  checking: { label: "Checking", icon: <Wallet className="w-4 h-4" />, variant: "default" },
  credit_card: { label: "Credit Card", icon: <CreditCard className="w-4 h-4" />, variant: "warning" },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: "",
    account_type: "cash" as AccountType,
    starting_balance: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAccounts();
      setAccounts(res.accounts);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const activeAccounts = accounts.filter((a) => a.is_active);
  const inactiveAccounts = accounts.filter((a) => !a.is_active);
  const totalBalance = activeAccounts.reduce((s, a) => s + a.display_balance, 0);

  const openCreate = () => {
    setEditAccount(null);
    setForm({ name: "", account_type: "cash", starting_balance: "" });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (account: Account) => {
    setEditAccount(account);
    setForm({
      name: account.name,
      account_type: account.account_type,
      starting_balance: "",
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Account name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editAccount) {
        await api.updateAccount(editAccount.id, {
          name: form.name.trim(),
          account_type: form.account_type,
        });
      } else {
        const balance = form.starting_balance ? parseFloat(form.starting_balance) : undefined;
        await api.createAccount({
          name: form.name.trim(),
          account_type: form.account_type,
          starting_balance: balance ? displayToMinor(balance) : undefined,
        });
      }
      setShowModal(false);
      fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // §5.5: Deactivating (not deleting) is the primary "remove" action
  const handleToggleActive = async (account: Account) => {
    try {
      if (account.is_active) {
        await api.deleteAccount(account.id);
      }
      // Note: reactivation may need backend support
      fetchAccounts();
    } catch (err) {
      console.error("Failed to toggle account:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Accounts</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage your financial accounts
            </p>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Account
          </Button>
        </div>

        {/* Total balance */}
        {!loading && activeAccounts.length > 0 && (
          <Card className="mb-6 !p-4 border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Balance</p>
                <AmountText amount={totalBalance} context="balance" size="hero" />
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">{activeAccounts.length} active accounts</p>
              </div>
            </div>
          </Card>
        )}

        {/* Account cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse-soft">
                <div className="space-y-3">
                  <div className="h-5 bg-zinc-800 rounded w-2/3" />
                  <div className="h-7 bg-zinc-800 rounded w-1/2" />
                  <div className="h-4 bg-zinc-800 rounded w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : activeAccounts.length === 0 && inactiveAccounts.length === 0 ? (
          <EmptyState
            icon={<Landmark className="w-7 h-7" />}
            title="No accounts yet"
            description="Create your first account to start tracking your money."
            action={{ label: "Add Account", onClick: openCreate }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeAccounts.map((account) => {
                const config = ACCOUNT_TYPE_CONFIG[account.account_type] || ACCOUNT_TYPE_CONFIG.cash;
                return (
                  <Card key={account.id} className="group relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">
                          {config.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{account.name}</p>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(account)}
                          className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(account)}
                          className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors cursor-pointer"
                          title="Deactivate account"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <AmountText
                      amount={account.display_balance}
                      currency={account.currency}
                      context="balance"
                      size="lg"
                    />
                  </Card>
                );
              })}
            </div>

            {/* Inactive accounts */}
            {inactiveAccounts.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm text-zinc-500 mb-3">Inactive Accounts</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactiveAccounts.map((account) => {
                    const config = ACCOUNT_TYPE_CONFIG[account.account_type] || ACCOUNT_TYPE_CONFIG.cash;
                    return (
                      <Card key={account.id} className="opacity-60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-600">
                              {config.icon}
                            </div>
                            <div>
                              <p className="text-sm text-zinc-400">{account.name}</p>
                              <span className="text-xs text-zinc-600 tabular-nums">
                                {account.display_balance}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editAccount ? "Edit Account" : "Create Account"}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Account Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cash, HDFC Savings..."
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Account Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ACCOUNT_TYPE_CONFIG) as [AccountType, typeof ACCOUNT_TYPE_CONFIG.cash][]).map(
                ([type, config]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, account_type: type }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all cursor-pointer ${
                      form.account_type === type
                        ? "border-emerald-500/50 bg-emerald-500/10 text-zinc-100"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                )
              )}
            </div>
          </div>

          {!editAccount && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-100">
                Starting Balance <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.starting_balance}
                  onChange={(e) => setForm((f) => ({ ...f, starting_balance: e.target.value }))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button onClick={handleSave} loading={saving} className="w-full">
            {editAccount ? "Update Account" : "Create Account"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
