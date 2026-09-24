// Goals as pure functions: which goal to feature, the countdown, contribution
// maths, and the goal form (draft, validation, create and edit payloads).
// Type-only imports plus explicit .ts siblings so `npm test` can run it. Every
// amount is an integer in minor units; the form holds text and parses it once.

import { daysUntil } from "./dates.ts";
import { diffFields } from "./ledger.ts";
import { minorToAmountText, parseAmountToMinor } from "./money.ts";
import type { Goal, GoalCreate, GoalPriority, GoalType, GoalUpdate } from "./types";

export const GOAL_TITLE_MAX = 255; // backend GoalCreate.title
export const GOAL_DESCRIPTION_MAX = 1000; // backend GoalCreate.description

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const GOAL_TYPES: readonly string[] = [
  "emergency_fund",
  "purchase",
  "vacation",
  "investment",
  "debt_repayment",
  "education",
  "retirement",
  "custom",
];

/** The goal to spotlight: highest priority (high > medium > low > none); ties keep list order. */
export function featuredGoal<G extends Pick<Goal, "priority">>(goals: readonly G[]): G | undefined {
  let best: G | undefined;
  for (const goal of goals) {
    if (!best || (PRIORITY_RANK[goal.priority ?? ""] ?? 0) > (PRIORITY_RANK[best.priority ?? ""] ?? 0)) best = goal;
  }
  return best;
}

export type Countdown = { label: string; overdue: boolean };

/** "12 days left", "Due today" or "Past due"; null when the goal has no (valid) target date. */
export function countdown(target: string | null, today: string): Countdown | null {
  if (!target) return null;
  const days = daysUntil(target, today);
  if (days === null) return null;
  if (days < 0) return { label: "Past due", overdue: true };
  if (days === 0) return { label: "Due today", overdue: false };
  return { label: `${days} day${days === 1 ? "" : "s"} left`, overdue: false };
}

/** Whole-number percent of the target reached (may exceed 100), by integer maths. */
export function percentOf(current: number, target: number): number {
  return target > 0 ? Math.floor((current * 100) / target) : 0;
}

/** What contributing `contribution` does to a goal: the new saved total, its percent, and whether it reaches the target. */
export function contributionPreview(current: number, target: number, contribution: number) {
  const total = current + contribution;
  return { total, percent: percentOf(total, target), achieves: total >= target };
}

/** True exactly when a save moved the goal from active to completed (the only time to celebrate). */
export function justAchieved(before: Pick<Goal, "status">, after: Pick<Goal, "status">): boolean {
  return before.status === "active" && after.status === "completed";
}

// ── The goal form ───────────────────────────────────────────────

export type GoalDraft = {
  title: string;
  type: GoalType | null;
  priority: GoalPriority | null;
  /** Amount text; parsed to minor units only by validateGoalDraft. */
  target: string;
  /** Amount already saved; empty means 0. */
  saved: string;
  /** "YYYY-MM-DD" or null */
  date: string | null;
  description: string;
};

export function emptyGoalDraft(): GoalDraft {
  return { title: "", type: null, priority: "medium", target: "", saved: "", date: null, description: "" };
}

// Rows written before the API validated these can hold other strings: read them as "not set".
const asType = (value: string | null): GoalType | null =>
  value !== null && GOAL_TYPES.includes(value) ? (value as GoalType) : null;
const asPriority = (value: string | null): GoalPriority | null =>
  value === "low" || value === "medium" || value === "high" ? value : null;

export function goalDraftFromGoal(goal: Goal): GoalDraft {
  return {
    title: goal.title,
    type: asType(goal.goal_type),
    priority: asPriority(goal.priority),
    target: minorToAmountText(goal.target_amount),
    saved: minorToAmountText(goal.current_amount),
    date: goal.target_date,
    description: goal.description ?? "",
  };
}

export type GoalErrors = { title?: string; target?: string; saved?: string };

export function validateGoalDraft(draft: GoalDraft): { target: number | null; saved: number | null; errors: GoalErrors } {
  const errors: GoalErrors = {};

  const title = draft.title.trim();
  if (!title) errors.title = "Give the goal a name.";
  else if (title.length > GOAL_TITLE_MAX) errors.title = `Keep the name under ${GOAL_TITLE_MAX} characters.`;

  const target = parseAmountToMinor(draft.target);
  if (draft.target.trim() === "") errors.target = "Enter a target amount.";
  else if (target === null) errors.target = "Enter a valid amount, like 50000 or 50000.50.";
  else if (target === 0) errors.target = "The target must be more than 0.";

  const savedText = draft.saved.trim();
  const saved = savedText === "" ? 0 : parseAmountToMinor(savedText);
  if (saved === null) errors.saved = "Enter a valid amount, or leave this empty.";

  return { target: errors.target ? null : target, saved: errors.saved ? null : saved, errors };
}

export function toGoalCreate(draft: GoalDraft, target: number, saved: number): GoalCreate {
  const description = draft.description.trim();
  return {
    title: draft.title.trim(),
    target_amount: target,
    current_amount: saved,
    ...(draft.type ? { goal_type: draft.type } : {}),
    ...(draft.priority ? { priority: draft.priority } : {}),
    ...(draft.date ? { target_date: draft.date } : {}),
    ...(description ? { description } : {}),
  };
}

/** The fields the edit form can change, compared by value. */
export type GoalFields = {
  title: string;
  goal_type: GoalType | null;
  priority: GoalPriority | null;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  description: string | null;
};

export function goalFieldsOf(goal: Goal): GoalFields {
  return {
    title: goal.title,
    goal_type: asType(goal.goal_type),
    priority: asPriority(goal.priority),
    target_amount: goal.target_amount,
    current_amount: goal.current_amount,
    target_date: goal.target_date,
    description: goal.description?.trim() || null,
  };
}

/** PATCH body: only what changed. Empty means nothing to save. */
export function goalEditPatch(goal: Goal, draft: GoalDraft, target: number, saved: number): GoalUpdate {
  const current: GoalFields = {
    title: draft.title.trim(),
    goal_type: draft.type,
    priority: draft.priority,
    target_amount: target,
    current_amount: saved,
    target_date: draft.date,
    description: draft.description.trim() || null,
  };
  return diffFields(goalFieldsOf(goal), current);
}

/** A stable fingerprint of the form, so "dirty" ignores object identity. */
export function goalDraftKey(draft: GoalDraft): string {
  return JSON.stringify([draft.title.trim(), draft.type, draft.priority, draft.target.trim(), draft.saved.trim(), draft.date, draft.description.trim()]);
}
