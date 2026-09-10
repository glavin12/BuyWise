/**
 * Goals — DESIGN.md §5.5
 *
 * Card grid, each card a progress ring + target amount + "Update progress"
 * action wired to update_goal endpoint.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Target,
  Plus,
  Pencil,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmountText } from "@/components/ui/amount-text";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { formatCurrency, displayToMinor, formatDate } from "@/lib/format";
import type { Goal, Category } from "@/lib/types";

const STATUS_TABS = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

const PRIORITY_CONFIG: Record<string, { variant: "warning" | "info" | "default"; label: string }> = {
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  low: { variant: "default", label: "Low" },
};

export default function GoalsPage() {
  const [activeTab, setActiveTab] = useState("active");
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

  // Update progress modal
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [progressAmount, setProgressAmount] = useState("");
  const [updatingProgress, setUpdatingProgress] = useState(false);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listGoals(activeTab);
      setGoals(res.goals);
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    api.listCategories().then((res) => setCategories(res.categories)).catch(() => {});
  }, []);

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
      fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProgress = async () => {
    if (!progressGoal || !progressAmount) return;
    const num = parseFloat(progressAmount);
    if (isNaN(num) || num < 0) return;
    setUpdatingProgress(true);
    try {
      await api.updateGoal(progressGoal.id, {
        current_amount: displayToMinor(num),
      });
      setProgressGoal(null);
      setProgressAmount("");
      fetchGoals();
    } catch (err) {
      console.error("Failed to update progress:", err);
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleStatusChange = async (goal: Goal, status: "active" | "completed" | "archived") => {
    try {
      await api.updateGoal(goal.id, { status });
      fetchGoals();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Goals</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Track progress toward your financial targets
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> New Goal
          </Button>
        </div>

        {/* Status tabs */}
        <div className="mb-6">
          <Tabs
            tabs={STATUS_TABS}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id)}
          />
        </div>

        {/* Goal cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse-soft">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-zinc-800 rounded w-3/4" />
                    <div className="h-4 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={<Target className="w-7 h-7" />}
            title={`No ${activeTab} goals`}
            description={
              activeTab === "active"
                ? "Create a goal to start tracking your progress."
                : `You don't have any ${activeTab} goals yet.`
            }
            action={
              activeTab === "active"
                ? { label: "Create Goal", onClick: () => setShowCreate(true) }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const priorityConfig = PRIORITY_CONFIG[goal.priority || "medium"];
              return (
                <Card key={goal.id} className="group">
                  <div className="flex items-start gap-4 mb-4">
                    <ProgressRing value={goal.progress_percent} size={64} strokeWidth={5}>
                      <span className="text-xs font-semibold text-zinc-100 tabular-nums">
                        {Math.round(goal.progress_percent)}%
                      </span>
                    </ProgressRing>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-100 truncate">
                        {goal.title}
                      </p>
                      {goal.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          {goal.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {priorityConfig && (
                          <Badge variant={priorityConfig.variant}>
                            {priorityConfig.label}
                          </Badge>
                        )}
                        {goal.category && (
                          <Badge variant="default">{goal.category}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Progress</span>
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {formatCurrency(goal.display_current_amount)} / {formatCurrency(goal.display_target_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Remaining</span>
                      <span className="text-xs text-zinc-300 tabular-nums">
                        {formatCurrency(goal.display_remaining_amount)}
                      </span>
                    </div>
                    {goal.display_monthly_needed_to_hit_target !== null && goal.display_monthly_needed_to_hit_target !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Monthly needed</span>
                        <span className="text-xs text-amber-400 tabular-nums">
                          {formatCurrency(goal.display_monthly_needed_to_hit_target)}
                        </span>
                      </div>
                    )}
                    {goal.target_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Target
                        </span>
                        <span className="text-xs text-zinc-400">
                          {formatDate(goal.target_date, "medium")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {activeTab === "active" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => {
                            setProgressGoal(goal);
                            setProgressAmount(String(goal.display_current_amount));
                          }}
                        >
                          <TrendingUp className="w-3.5 h-3.5 mr-1" /> Update
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(goal, "completed")}
                        >
                          Complete
                        </Button>
                      </>
                    )}
                    {activeTab === "completed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatusChange(goal, "archived")}
                      >
                        Archive
                      </Button>
                    )}
                    {activeTab === "archived" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatusChange(goal, "active")}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Goal Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Goal" size="md">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Title</label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Emergency Fund, Vacation..."
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">Target Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={createForm.target_amount}
                onChange={(e) => setCreateForm((f) => ({ ...f, target_amount: e.target.value }))}
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">
              Description <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What's this goal for?"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-100">Priority</label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-100">Target Date</label>
              <input
                type="date"
                value={createForm.target_date}
                onChange={(e) => setCreateForm((f) => ({ ...f, target_date: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-100">
              Category <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <select
              value={createForm.category_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, category_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="">No category</option>
              {categories.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button onClick={handleCreate} loading={saving} className="w-full">
            Create Goal
          </Button>
        </div>
      </Modal>

      {/* Update Progress Modal */}
      <Modal
        open={!!progressGoal}
        onClose={() => setProgressGoal(null)}
        title="Update Progress"
        size="sm"
      >
        {progressGoal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
              <ProgressRing value={progressGoal.progress_percent} size={48} strokeWidth={4}>
                <span className="text-[10px] font-medium text-zinc-300 tabular-nums">
                  {Math.round(progressGoal.progress_percent)}%
                </span>
              </ProgressRing>
              <div>
                <p className="text-sm font-medium text-zinc-100">{progressGoal.title}</p>
                <p className="text-xs text-zinc-500 tabular-nums">
                  Target: {formatCurrency(progressGoal.display_target_amount)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-100">Current Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={progressAmount}
                  onChange={(e) => setProgressAmount(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <Button onClick={handleUpdateProgress} loading={updatingProgress} className="w-full">
              Update Progress
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
