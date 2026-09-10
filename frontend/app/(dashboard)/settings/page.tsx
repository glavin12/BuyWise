/**
 * Settings — DESIGN.md §3 IA
 *
 * Sub-navigation: Profile, Categories, Payees.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  User,
  Tag,
  Users,
  Save,
  Pencil,
  Trash2,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryTag } from "@/components/ui/category-tag";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import type {
  UserProfile,
  ProfileUpdate,
  Category,
  CategoryType,
  Payee,
} from "@/lib/types";

const SETTINGS_TABS = [
  { id: "profile", label: "Profile" },
  { id: "categories", label: "Categories" },
  { id: "payees", label: "Payees" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage your profile, categories, and payees
          </p>
        </div>

        <div className="mb-6">
          <Tabs tabs={SETTINGS_TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {activeTab === "profile" && <ProfileSection />}
        {activeTab === "categories" && <CategoriesSection />}
        {activeTab === "payees" && <PayeesSection />}
      </div>
    </div>
  );
}

/* ── Profile Section ────────────────────────────────────────────── */

function ProfileSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileUpdate>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        setProfile(p);
        setForm({
          full_name: p.full_name || "",
          currency: p.currency,
          income_type: p.income_type || "",
          salary_day: p.salary_day,
          timezone: p.timezone,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const updated = await api.updateProfile(form);
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse-soft">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-100">Full Name</label>
          <input
            type="text"
            value={form.full_name || ""}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Currency</label>
            <select
              value={form.currency || "INR"}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Income Type</label>
            <select
              value={form.income_type || ""}
              onChange={(e) => setForm((f) => ({ ...f, income_type: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="">Not set</option>
              <option value="salaried">Salaried</option>
              <option value="freelance">Freelance</option>
              <option value="business">Business</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-100">Salary Day</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.salary_day ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, salary_day: e.target.value ? parseInt(e.target.value) : null }))}
            placeholder="Day of month (1-31)"
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4 mr-1" /> Save Changes
          </Button>
          {success && (
            <span className="text-sm text-emerald-400">Saved successfully!</span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── Categories Section — §5.5 ──────────────────────────────────── */

function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "expense" as CategoryType,
    icon: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listCategories();
      setCategories(res.categories);
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const expenseCategories = categories.filter((c) => c.type === "expense" && c.is_active);
  const incomeCategories = categories.filter((c) => c.type === "income" && c.is_active);

  const openCreate = () => {
    setEditCat(null);
    setForm({ name: "", type: "expense", icon: "" });
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setForm({ name: cat.name, type: cat.type, icon: cat.icon || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editCat) {
        await api.updateCategory(editCat.id, {
          name: form.name.trim(),
          type: form.type,
          icon: form.icon || null,
        });
      } else {
        await api.createCategory({
          name: form.name.trim(),
          type: form.type,
          icon: form.icon || null,
        });
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      console.error("Failed to save category:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCategory(id);
      fetchCategories();
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  const renderCategoryGroup = (title: string, cats: Category[]) => (
    <div className="mb-6">
      <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1">
        {cats.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-900/50 group transition-colors"
          >
            <div className="flex items-center gap-2">
              <CategoryTag name={cat.name} icon={cat.icon} color={cat.color} />
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openEdit(cat)}
                className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-400">{categories.length} categories</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse-soft" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={<Tag className="w-7 h-7" />}
            title="No categories"
            description="Categories will be created when you set up your profile."
          />
        ) : (
          <>
            {expenseCategories.length > 0 && renderCategoryGroup("Expense Categories", expenseCategories)}
            {incomeCategories.length > 0 && renderCategoryGroup("Income Categories", incomeCategories)}
          </>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editCat ? "Edit Category" : "New Category"} size="sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Category name..."
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as CategoryType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`px-3 py-2 rounded-lg border text-sm capitalize transition-all cursor-pointer ${
                    form.type === t
                      ? "border-emerald-500/50 bg-emerald-500/10 text-zinc-100"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">
              Icon <span className="text-zinc-600 font-normal">(emoji, optional)</span>
            </label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="🍔"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              maxLength={4}
            />
          </div>
          <Button onClick={handleSave} loading={saving} className="w-full">
            {editCat ? "Update" : "Create"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ── Payees Section — §5.5 ──────────────────────────────────────── */

function PayeesSection() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editPayee, setEditPayee] = useState<Payee | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPayees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listPayees();
      setPayees(res.payees);
    } catch (err) {
      console.error("Failed to load payees:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayees();
  }, [fetchPayees]);

  const filtered = payees.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editPayee) {
        await api.updatePayee(editPayee.id, { name: name.trim() });
      } else {
        await api.createPayee({ name: name.trim() });
      }
      setShowModal(false);
      setName("");
      setEditPayee(null);
      fetchPayees();
    } catch (err) {
      console.error("Failed to save payee:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePayee(id);
      fetchPayees();
    } catch (err) {
      console.error("Failed to delete payee:", err);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payees..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
        <Button size="sm" onClick={() => { setEditPayee(null); setName(""); setShowModal(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse-soft" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title={search ? "No matching payees" : "No payees yet"}
            description="Payees are created automatically when you add transactions."
          />
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filtered.map((payee) => (
              <div
                key={payee.id}
                className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-zinc-900/50 group transition-colors"
              >
                <span className="text-sm text-zinc-100">{payee.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditPayee(payee); setName(payee.name); setShowModal(true); }}
                    className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(payee.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editPayee ? "Edit Payee" : "New Payee"} size="sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Payee name..."
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <Button onClick={handleSave} loading={saving} className="w-full">
            {editPayee ? "Update" : "Create"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
