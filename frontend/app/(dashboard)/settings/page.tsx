/**
 * Settings — colorful-cream reskin (see _Settings.dc.html).
 *
 * Sticky left rail (7 sections) + one card per section. Profile/Categories/
 * Payees are wired to the real backend; Notifications only exposes
 * `budget_alerts` (the one real profile field) — everything else without a
 * backend field renders via lib/coming-soon.
 */
"use client";

import { useState, useEffect, useCallback, type ButtonHTMLAttributes } from "react";
import { Tag, Users, Pencil, Trash2, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { InlineEditableField } from "@/components/ui/inline-editable-field";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { categoryStyle, categoryEmoji, HUES } from "@/lib/categories";
import { comingSoonProps } from "@/lib/coming-soon";
import { createClient } from "@/lib/supabase/client";
import type {
  UserProfile,
  ProfileUpdate,
  Category,
  CategoryType,
  Payee,
} from "@/lib/types";

const TABS = [
  { id: "profile", label: "Profile", icon: "👤", dot: "#FF6F5C" },
  { id: "categories", label: "Categories", icon: "◧", dot: "#F2C14E" },
  { id: "payees", label: "Payees", icon: "☺", dot: "#6FCF97" },
  { id: "notifications", label: "Notifications", icon: "🔔", dot: "#6FA8DC" },
  { id: "ai", label: "AI assistant", icon: "✦", dot: "#5EC5C1" },
  { id: "data", label: "Data & security", icon: "🔒", dot: "#A46FCF" },
  { id: "billing", label: "Billing", icon: "💳", dot: "#E48BB0" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  return (
    <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="mb-6">
          <h1 className="serif text-[32px] sm:text-[44px] leading-none text-primary">
            Settings
          </h1>
          <p className="text-sm text-secondary mt-1.5">
            Everything about your ledger, your way in, and how the AI can help.
          </p>
        </div>

        <div className="grid lg:grid-cols-[220px_1fr] gap-6">
          {/* Tab rail — row on mobile, sticky column on desktop */}
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-8 lg:self-start -mx-4 px-4 lg:mx-0 lg:px-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                aria-current={activeTab === t.id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0",
                  activeTab === t.id
                    ? "bg-surface text-primary"
                    : "text-tertiary hover:bg-surface-hover"
                )}
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] text-[11px] shrink-0"
                  style={{ backgroundColor: t.dot }}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-5 min-w-0">
            {activeTab === "profile" && <ProfileSection />}
            {activeTab === "categories" && <CategoriesSection />}
            {activeTab === "payees" && <PayeesSection />}
            {activeTab === "notifications" && <NotificationsSection />}
            {activeTab === "ai" && <AiAssistantSection />}
            {activeTab === "data" && <DataSecuritySection />}
            {activeTab === "billing" && <BillingSection />}

            <div className="text-center py-2 text-[11px] text-secondary">
              BuyWise · v0.7.2 (review build) · every rupee, a job.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small local helpers (shared across sections below) ───────────── */

function SettingRow({
  label,
  hint,
  soon,
  children,
}: {
  label: string;
  hint?: string;
  soon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-primary flex items-center gap-1.5">
          {label}
          {soon && (
            <span className="text-[10px] font-normal text-secondary bg-surface-hover px-1.5 py-0.5 rounded-full">
              soon
            </span>
          )}
        </div>
        {hint && <div className="text-xs text-secondary mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Pill toggle switch. Pass `{...comingSoonProps("X")}` instead of `onClick` for non-wired toggles. */
function Toggle({
  on,
  className,
  ...props
}: { on: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors shrink-0",
        on ? "bg-[#F2C14E]" : "bg-border",
        props.disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
          on ? "right-0.5" : "left-0.5"
        )}
      />
    </button>
  );
}

function initialsFrom(name: string | null | undefined, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase() || "?";
}

/* ── Profile Section ────────────────────────────────────────────── */

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — British Pound (£)" },
];

/** Full IANA zone list, via the native Intl API — no hand-maintained list. */
const TIMEZONE_OPTIONS: { value: string; label: string }[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone").map((z) => ({
      value: z,
      label: z.replace(/_/g, " "),
    }));
  } catch {
    return [
      { value: "Asia/Kolkata", label: "Asia/Kolkata" },
      { value: "UTC", label: "UTC" },
    ];
  }
})();

function ProfileSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user?.email) setEmail(data.user.email);
      });
  }, []);

  const save = async (patch: ProfileUpdate) => {
    setSaving(true);
    try {
      const updated = await api.updateProfile(patch);
      setProfile(updated);
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
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-hover rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Card>
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-divider flex-wrap">
        <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#FF6F5C] to-[#F2C14E] flex items-center justify-center text-white serif text-[28px] shrink-0">
          {initialsFrom(profile?.full_name, email)}
        </div>
        <div className="min-w-0">
          <InlineEditableField
            value={profile?.full_name || ""}
            onSave={(v) => save({ full_name: v })}
            placeholder="Add your name"
            displayClassName="text-lg font-semibold text-primary"
          />
          <div className="text-[13px] text-secondary mt-0.5">
            {email}
            {joined && ` · joined ${joined}`}
          </div>
        </div>
      </div>

      <div className="divide-y divide-divider">
        <SettingRow
          label="Currency"
          hint="Every amount in the app renders in this currency."
        >
          <Select
            value={profile?.currency || "INR"}
            onChange={(e) => save({ currency: e.target.value })}
            options={CURRENCY_OPTIONS}
            disabled={saving}
            className="w-auto"
          />
        </SettingRow>
        <SettingRow label="Time zone" hint="Used for transaction dates and reports.">
          <Select
            value={profile?.timezone || "UTC"}
            onChange={(e) => save({ timezone: e.target.value })}
            options={TIMEZONE_OPTIONS}
            disabled={saving}
            className="w-auto max-w-[220px]"
          />
        </SettingRow>
        <SettingRow
          label="Week starts on"
          hint="Affects weekly rollups in Reports."
          soon
        >
          <div className="flex gap-1 bg-surface-hover rounded-xl p-1">
            <FilterChip type="button" {...comingSoonProps("Week start day")}>
              Sun
            </FilterChip>
            <FilterChip type="button" active {...comingSoonProps("Week start day")}>
              Mon
            </FilterChip>
          </div>
        </SettingRow>
      </div>
    </Card>
  );
}

/* ── Categories Section ─────────────────────────────────────────── */

const SWATCHES = [HUES.coral, HUES.amber, HUES.mint, HUES.sky, HUES.plum];

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

  const fetchCategories = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
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
    fetchCategories(true);
  }, [fetchCategories]);

  const active = categories.filter((c) => c.is_active);

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
        // A category's type is fixed once created (the API ignores it on update).
        await api.updateCategory(editCat.id, {
          name: form.name.trim(),
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
      fetchCategories(false);
    } catch (err) {
      console.error("Failed to save category:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.deleteCategory(id);
      fetchCategories(false);
    } catch (err) {
      console.error("Failed to delete category:", err);
      fetchCategories(false);
    }
  };

  const setColor = async (cat: Category, hex: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, color: hex } : c))
    );
    try {
      await api.updateCategory(cat.id, { color: hex });
      fetchCategories(false);
    } catch (err) {
      console.error("Failed to update category color:", err);
      fetchCategories(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div>
            <div className="text-[15px] font-semibold text-primary">Categories</div>
            <div className="text-xs text-secondary mt-0.5">
              Colors are used everywhere the category shows up.
            </div>
          </div>
          <FilterChip type="button" active className="ml-auto" onClick={openCreate}>
            + New category
          </FilterChip>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-surface-hover rounded-xl animate-pulse-soft" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <EmptyState
            icon={<Tag className="w-7 h-7" />}
            title="No categories"
            description="Categories will be created when you set up your profile."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {active.map((cat) => {
              const style = categoryStyle(cat.name);
              const currentColor = cat.color || style.bar;
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                  style={{ backgroundColor: style.bg }}
                >
                  <div
                    className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[15px] shrink-0"
                    style={{ backgroundColor: style.bar }}
                  >
                    {categoryEmoji(cat.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: style.fg }}
                    >
                      {cat.name}
                    </div>
                    <div
                      className="text-[11px] truncate opacity-75"
                      style={{ color: style.fg }}
                    >
                      {cat.type === "expense" ? "Expense" : "Income"} category
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {SWATCHES.map((h) => (
                      <button
                        key={h.bar}
                        type="button"
                        onClick={() => setColor(cat, h.bar)}
                        aria-label={`Set ${cat.name} color to ${h.bar}`}
                        className={cn(
                          "w-3.5 h-3.5 rounded-full border-2 cursor-pointer",
                          currentColor === h.bar ? "border-primary" : "border-transparent"
                        )}
                        style={{ backgroundColor: h.bar }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    aria-label={`Edit ${cat.name}`}
                    className="p-1 shrink-0 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                    style={{ color: style.fg }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat.id)}
                    aria-label={`Delete ${cat.name}`}
                    className="p-1 shrink-0 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                    style={{ color: style.fg }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editCat ? "Edit category" : "New category"}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Category name..."
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-primary">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as CategoryType[]).map((t) => (
                <FilterChip
                  key={t}
                  type="button"
                  active={form.type === t}
                  disabled={!!editCat}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className="capitalize justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t}
                </FilterChip>
              ))}
            </div>
          </div>
          <Input
            label="Icon (emoji, optional)"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder="🍔"
            maxLength={4}
          />
          <Button onClick={handleSave} loading={saving} className="w-full">
            {editCat ? "Update" : "Create"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ── Payees Section ─────────────────────────────────────────────── */

function PayeesSection() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editPayee, setEditPayee] = useState<Payee | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [saving, setSaving] = useState(false);

  const fetchPayees = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
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
    fetchPayees(true);
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
        await api.createPayee({ name: name.trim(), type });
      }
      setShowModal(false);
      setName("");
      setEditPayee(null);
      fetchPayees(false);
    } catch (err) {
      console.error("Failed to save payee:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPayees((prev) => prev.filter((p) => p.id !== id));
    try {
      await api.deletePayee(id);
      fetchPayees(false);
    } catch (err) {
      console.error("Failed to delete payee:", err);
      fetchPayees(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payees..."
              className="pl-9"
              aria-label="Search payees"
            />
          </div>
          <FilterChip
            type="button"
            active
            onClick={() => {
              setEditPayee(null);
              setName("");
              setType("expense");
              setShowModal(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </FilterChip>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-surface-hover rounded-xl animate-pulse-soft" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title={search ? "No matching payees" : "No payees yet"}
            description="Payees are created automatically when you add transactions."
          />
        ) : (
          <div className="divide-y divide-divider">
            {filtered.map((payee) => (
              <div key={payee.id} className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-sm text-primary">
                  {payee.name}
                  <Badge variant={payee.type === "income" ? "success" : "info"}>
                    {payee.type}
                  </Badge>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPayee(payee);
                      setName(payee.name);
                      setType(payee.type);
                      setShowModal(true);
                    }}
                    aria-label={`Edit ${payee.name}`}
                    className="p-1.5 text-secondary hover:text-primary transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(payee.id)}
                    aria-label={`Delete ${payee.name}`}
                    className="p-1.5 text-secondary hover:text-negative transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editPayee ? "Edit payee" : "New payee"}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Payee name..."
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          {editPayee ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">Type</label>
              <Badge variant={type === "income" ? "success" : "info"} className="capitalize">
                {type}
              </Badge>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["expense", "income"] as CategoryType[]).map((t) => (
                  <FilterChip
                    key={t}
                    type="button"
                    active={type === t}
                    onClick={() => setType(t)}
                    className="capitalize justify-center"
                  >
                    {t}
                  </FilterChip>
                ))}
              </div>
            </div>
          )}
          <Button onClick={handleSave} loading={saving} className="w-full">
            {editPayee ? "Update" : "Create"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ── Notifications Section — only budget_alerts is real ───────────── */

function NotificationsSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  const toggleBudgetAlerts = async () => {
    if (!profile) return;
    const next = !profile.budget_alerts;
    setProfile({ ...profile, budget_alerts: next });
    setSaving(true);
    try {
      await api.updateProfile({ budget_alerts: next });
    } catch (err) {
      console.error("Failed to update budget alerts:", err);
      setProfile((p) => (p ? { ...p, budget_alerts: !next } : p));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-2">
        <div className="text-[15px] font-semibold text-primary">Notifications</div>
        <div className="text-xs text-secondary mt-0.5">
          Get told when it matters, ignored when it doesn&apos;t.
        </div>
      </div>
      <div className="divide-y divide-divider">
        <SettingRow
          label="Envelope 90% used"
          hint="Warn me before a category goes over budget."
        >
          <Toggle
            on={!!profile?.budget_alerts}
            onClick={toggleBudgetAlerts}
            disabled={!profile || saving}
            aria-label="Envelope 90% used alerts"
          />
        </SettingRow>
        <SettingRow
          label="Weekly recap · Monday 8am"
          hint="A one-screen summary of last week."
          soon
        >
          <Toggle
            on={false}
            aria-label="Weekly recap"
            {...comingSoonProps("Weekly recap")}
          />
        </SettingRow>
        <SettingRow
          label="Unusual transaction detected"
          hint="AI flags something well outside your pattern."
          soon
        >
          <Toggle
            on={false}
            aria-label="Unusual transaction alerts"
            {...comingSoonProps("Unusual transaction alerts")}
          />
        </SettingRow>
        <SettingRow label="Goal milestones" hint="Ping me at 25 / 50 / 75 / 100%." soon>
          <Toggle
            on={false}
            aria-label="Goal milestone alerts"
            {...comingSoonProps("Goal milestone alerts")}
          />
        </SettingRow>
      </div>
    </Card>
  );
}

/* ── AI assistant Section — no backend fields yet ──────────────────── */

function AiAssistantSection() {
  return (
    <Card>
      <div className="mb-2">
        <div className="text-[15px] font-semibold text-primary">AI assistant</div>
        <div className="text-xs text-secondary mt-0.5">
          Powered by Claude · you own the ledger.
        </div>
      </div>
      <div className="divide-y divide-divider">
        <SettingRow label="Auto-categorize new transactions" soon>
          <Toggle on={false} aria-label="Auto-categorize" {...comingSoonProps("Auto-categorize")} />
        </SettingRow>
        <SettingRow label="Suggest envelope adjustments" soon>
          <Toggle
            on={false}
            aria-label="Suggest envelope adjustments"
            {...comingSoonProps("Envelope suggestions")}
          />
        </SettingRow>
        <SettingRow label="Allow chat to add transactions" soon>
          <Toggle
            on={false}
            aria-label="Allow chat to add transactions"
            {...comingSoonProps("Chat-added transactions")}
          />
        </SettingRow>
        <SettingRow label="Allow chat to move money between envelopes" soon>
          <Toggle
            on={false}
            aria-label="Allow chat to move money between envelopes"
            {...comingSoonProps("Chat envelope transfers")}
          />
        </SettingRow>
      </div>
    </Card>
  );
}

/* ── Data & security Section ───────────────────────────────────────── */

function DataSecuritySection() {
  return (
    <Card>
      <div className="mb-2">
        <div className="text-[15px] font-semibold text-primary">Data &amp; security</div>
        <div className="text-xs text-secondary mt-0.5">
          All amounts stored as integer minor units.
        </div>
      </div>
      <div className="divide-y divide-divider">
        <SettingRow
          label="Two-factor authentication"
          hint="Add an authenticator app for extra security."
          soon
        >
          <FilterChip type="button" {...comingSoonProps("Two-factor authentication")}>
            Set up
          </FilterChip>
        </SettingRow>
        <SettingRow label="Active sessions" hint="Review where you're signed in." soon>
          <FilterChip type="button" {...comingSoonProps("Active sessions")}>
            Review →
          </FilterChip>
        </SettingRow>
        <SettingRow
          label="Export ledger (CSV)"
          hint="Complete transaction history."
          soon
        >
          <FilterChip type="button" {...comingSoonProps("Export ledger CSV")}>
            Download
          </FilterChip>
        </SettingRow>
        <SettingRow label="Delete account" hint="This cannot be undone.">
          <Button variant="danger" size="sm" {...comingSoonProps("Delete account")}>
            Delete
          </Button>
        </SettingRow>
      </div>
    </Card>
  );
}

/* ── Billing Section ───────────────────────────────────────────────── */

function BillingSection() {
  return (
    <Card>
      <div className="mb-3">
        <div className="text-[15px] font-semibold text-primary">Billing</div>
        <div className="text-xs text-secondary mt-0.5">
          BuyWise is free during the review build.
        </div>
      </div>
      <Button variant="secondary" size="sm" {...comingSoonProps("Billing")}>
        Manage billing
      </Button>
    </Card>
  );
}
