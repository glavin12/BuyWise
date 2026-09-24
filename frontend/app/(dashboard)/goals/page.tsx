/**
 * Goals — colorful cream reskin, per _Goals.dc.html.
 * Featured goal (gradient hero) + contribute card, then the rest as a colored grid.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { AmountText } from "@/components/ui/amount-text";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { displayToMinor, formatMonth } from "@/lib/format";
import { categoryEmoji, categoryHue, HUES } from "@/lib/categories";
import { comingSoonProps } from "@/lib/coming-soon";
import type { Goal, Category } from "@/lib/types";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** "2027-04-15" → "April 2027" (reuses the shared month/year formatter). */
function monthYearLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return formatMonth(d.getMonth() + 1, d.getFullYear());
}

/** Whole months between now and a target date, floored at 0. */
function monthsUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
}

export default function GoalsPage() {
  const [status, setStatus] = useState<"active" | "completed">("active");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    target_amount: "",
    category_id: "",
    priority: "medium",
    target_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time top-up modal (contributes to the featured goal)
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [contributing, setContributing] = useState(false);

  const fetchGoals = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      try {
        const res = await api.listGoals(status);
        setGoals(res.goals);
      } catch (err) {
        console.error("Failed to load goals:", err);
      } finally {
        setLoading(false);
      }
    },
    [status]
  );

  useEffect(() => {
    fetchGoals(true);
  }, [fetchGoals]);

  useEffect(() => {
    api.listCategories().then((res) => setCategories(res.categories)).catch(() => {});
  }, []);

  // Featured = highest priority (first active, ties broken by list order); rest fill the grid.
  const sortedGoals = [...goals].sort(
    (a, b) => (PRIORITY_RANK[a.priority ?? "medium"] ?? 1) - (PRIORITY_RANK[b.priority ?? "medium"] ?? 1)
  );
  const featured = sortedGoals[0];
  const rest = sortedGoals.slice(1);

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.target_amount) {
      setError("Title and target amount are required");
      return;
    }
    const num = parseFloat(createForm.target_amount);
    if (isNaN(num) || num <= 0) {
      setError("Enter a valid target amount");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createGoal({
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        target_amount: displayToMinor(num),
        category_id: createForm.category_id || undefined,
        priority: createForm.priority || undefined,
        target_date: createForm.target_date || undefined,
      });
      setShowCreate(false);
      setCreateForm({
        title: "",
        description: "",
        target_amount: "",
        category_id: "",
        priority: "medium",
        target_date: "",
      });
      fetchGoals(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setSaving(false);
    }
  };

  const handleTopUp = async () => {
    if (!featured || !topUpAmount) return;
    const num = parseFloat(topUpAmount);
    if (isNaN(num) || num <= 0) return;
    setContributing(true);
    const addedMinor = displayToMinor(num);
    // Optimistic local update so featured goal progress updates immediately
    setGoals((prev) =>
      prev.map((g) =>
        g.id === featured.id
          ? {
              ...g,
              current_amount: g.current_amount + addedMinor,
              display_current_amount: g.display_current_amount + num,
              progress_percent:
                g.target_amount > 0
                  ? Math.min(100, ((g.current_amount + addedMinor) / g.target_amount) * 100)
                  : 0,
            }
          : g
      )
    );
    try {
      await api.updateGoal(featured.id, {
        current_amount: featured.current_amount + addedMinor,
      });
      setTopUpOpen(false);
      setTopUpAmount("");
      fetchGoals(false);
    } catch (err) {
      console.error("Failed to add contribution:", err);
      fetchGoals(false);
    } finally {
      setContributing(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="serif text-[44px] leading-none">Goals</h1>
          <p className="text-sm text-secondary mt-1.5">
            {goals.length} {status === "active" ? "active" : "achieved"}.
          </p>
        </div>
        <div className="flex gap-2">
          <FilterChip active={status === "active"} onClick={() => setStatus("active")}>
            Active
          </FilterChip>
          <FilterChip active={status === "completed"} onClick={() => setStatus("completed")}>
            Achieved
          </FilterChip>
          <FilterChip active onClick={() => setShowCreate(true)}>
            + New goal
          </FilterChip>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse-soft">
              <span className="sr-only">Loading</span>
            </Card>
          ))}
        </div>
      ) : !featured ? (
        <EmptyState
          icon={<Target className="w-7 h-7" />}
          title={`No ${status === "active" ? "active" : "achieved"} goals`}
          description={
            status === "active"
              ? "Create a goal to start tracking your progress."
              : "Goals you complete will show up here."
          }
          action={status === "active" ? { label: "New goal", onClick: () => setShowCreate(true) } : undefined}
        />
      ) : (
        <>
          {/* Featured goal + Contribute now */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 mb-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#6FA8DC] to-[#A46FCF] text-white rounded-[22px] p-7">
              <div className="absolute -right-10 -top-10 w-[220px] h-[220px] rounded-full bg-white/15" />
              <div className="absolute -bottom-8 right-14 sm:right-24 text-[96px] sm:text-[120px] opacity-15 leading-none">
                {categoryEmoji(featured.category)}
              </div>
              <div className="relative">
                <span className="inline-block bg-white/20 px-2.5 py-1 rounded-full text-[11px] font-medium">
                  {featured.target_date
                    ? `Featured goal · ${monthsUntil(featured.target_date)} months left`
                    : "Featured goal"}
                </span>
                <h2 className="serif text-[36px] sm:text-[44px] leading-[1.05] mt-3">{featured.title}</h2>
                {featured.description && <p className="text-[13px] opacity-90 mt-1.5">{featured.description}</p>}

                <div className="grid grid-cols-3 gap-4 sm:gap-5 mt-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] opacity-75">Saved</div>
                    <AmountText
                      amount={featured.display_current_amount}
                      size="lg"
                      className="text-white block mt-0.5"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] opacity-75">Target</div>
                    <AmountText
                      amount={featured.display_target_amount}
                      size="lg"
                      className="text-white block mt-0.5"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] opacity-75">Need / mo</div>
                    {featured.display_monthly_needed_to_hit_target != null ? (
                      <AmountText
                        amount={featured.display_monthly_needed_to_hit_target}
                        size="lg"
                        className="text-white block mt-0.5"
                      />
                    ) : (
                      <div className="serif text-xl mt-0.5">—</div>
                    )}
                  </div>
                </div>

                <div className="h-2.5 bg-white/20 rounded-full mt-5 overflow-hidden">
                  <div
                    className="h-full bg-[#F2C14E] rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(0, Math.min(featured.progress_percent, 100))}%` }}
                  />
                </div>
                <div className="flex items-center mt-2 text-xs opacity-90 tabular-nums">
                  <span>{Math.round(featured.progress_percent)}% funded</span>
                  {featured.target_date && (
                    <span className="ml-auto">Target date · {monthYearLabel(featured.target_date)}</span>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <p className="text-[15px] font-semibold mb-3.5">Contribute now</p>
              <div className="flex flex-col gap-2.5">
                <button
                  {...comingSoonProps("Move from balance")}
                  className="flex items-center gap-3 p-3.5 rounded-[14px] border text-left cursor-pointer"
                  style={{ backgroundColor: HUES.mint.bg, borderColor: HUES.mint.border }}
                >
                  <span
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: HUES.mint.bar }}
                  >
                    💰
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-primary">Move from balance</span>
                    <span className="block text-[11px] text-secondary">Fastest way to fund this goal</span>
                  </span>
                  <span className="text-base text-secondary">→</span>
                </button>

                <button
                  {...comingSoonProps("Auto-save monthly")}
                  className="flex items-center gap-3 p-3.5 rounded-[14px] border text-left cursor-pointer"
                  style={{ backgroundColor: HUES.amber.bg, borderColor: HUES.amber.border }}
                >
                  <span
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: HUES.amber.bar }}
                  >
                    📅
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-primary">Auto-save monthly</span>
                    <span className="block text-[11px] text-secondary">Set a recurring contribution</span>
                  </span>
                  <span className="text-base text-secondary">→</span>
                </button>

                <button
                  onClick={() => setTopUpOpen(true)}
                  className="flex items-center gap-3 p-3.5 rounded-[14px] border text-left cursor-pointer hover:brightness-[0.98] transition-[filter]"
                  style={{ backgroundColor: HUES.plum.bg, borderColor: HUES.plum.border }}
                >
                  <span
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: HUES.plum.bar }}
                  >
                    🎯
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-primary">One-time top-up</span>
                    <span className="block text-[11px] text-secondary">Enter any amount</span>
                  </span>
                  <span className="text-base text-secondary">→</span>
                </button>
              </div>
            </Card>
          </div>

          {/* Other goals */}
          {rest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((goal) => {
                const style = HUES[categoryHue(goal.category)];
                const label = goal.category || (goal.priority ? `${goal.priority} priority` : "Goal");
                return (
                  <div
                    key={goal.id}
                    className="rounded-[20px] p-5 sm:p-[22px] border"
                    style={{ backgroundColor: style.bg, borderColor: style.border }}
                  >
                    <div className="text-[36px] leading-none">{categoryEmoji(goal.category)}</div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-secondary mt-3.5">{label}</div>
                    <h3 className="serif text-[26px] leading-[1.1] text-primary">{goal.title}</h3>
                    <div className="flex items-center gap-1 text-[13px] text-tertiary mt-1.5">
                      <AmountText amount={goal.display_current_amount} size="sm" className="text-tertiary" />
                      <span>of</span>
                      <AmountText amount={goal.display_target_amount} size="sm" className="text-tertiary" />
                    </div>
                    <ProgressBar value={goal.progress_percent} color={style.bar} className="mt-3.5" />
                    <div className="flex items-center mt-2 text-[11px] text-tertiary tabular-nums">
                      <span>{Math.round(goal.progress_percent)}% funded</span>
                      {goal.target_date && <span className="ml-auto">{monthYearLabel(goal.target_date)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Goal Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New goal" size="md">
        <div className="space-y-4">
          <Input
            label="Title"
            value={createForm.title}
            onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Emergency fund, Vacation..."
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-primary">Target amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-secondary pointer-events-none">
                ₹
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={createForm.target_amount}
                onChange={(e) => setCreateForm((f) => ({ ...f, target_amount: e.target.value }))}
                placeholder="0.00"
                className="pl-8 tabular-nums"
              />
            </div>
          </div>

          <Textarea
            label="Description (optional)"
            value={createForm.description}
            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What's this goal for?"
            rows={2}
            maxLength={1000}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={createForm.priority}
              onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value }))}
              options={PRIORITY_OPTIONS}
            />
            <Input
              type="date"
              label="Target date"
              value={createForm.target_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, target_date: e.target.value }))}
            />
          </div>

          <Select
            label="Category (optional)"
            value={createForm.category_id}
            onChange={(e) => setCreateForm((f) => ({ ...f, category_id: e.target.value }))}
            options={[
              { value: "", label: "No category" },
              ...categories
                .filter((c) => c.is_active)
                .map((c) => ({ value: c.id, label: `${c.icon ? `${c.icon} ` : ""}${c.name}` })),
            ]}
          />

          {error && (
            <div className="p-3 bg-negative/10 border border-negative/20 rounded-lg">
              <p className="text-sm text-negative">{error}</p>
            </div>
          )}

          <Button onClick={handleCreate} loading={saving} className="w-full">
            Create goal
          </Button>
        </div>
      </Modal>

      {/* One-time top-up modal */}
      <Modal open={topUpOpen} onClose={() => setTopUpOpen(false)} title="One-time top-up" size="sm">
        {featured && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-surface-hover rounded-lg">
              <span className="text-2xl">{categoryEmoji(featured.category)}</span>
              <div>
                <p className="text-sm font-medium text-primary">{featured.title}</p>
                <p className="text-xs text-secondary tabular-nums">
                  {Math.round(featured.progress_percent)}% funded so far
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">Amount to add</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-secondary pointer-events-none">
                  ₹
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 tabular-nums"
                />
              </div>
            </div>

            <Button onClick={handleTopUp} loading={contributing} className="w-full">
              Add to goal
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
