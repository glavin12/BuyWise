// Budget maths as pure functions: the line under "ready to assign", how far a category is
// through its budget (and its row in words, rolled-over money included), which categories still
// have none, and the sequential "copy from last month" runner. Type-only imports plus explicit .ts
// siblings so `npm test` can run it. Every figure is an integer in minor units. What is left to
// assign (`unassigned`) and each category's available money are worked out by the API.

import type { BudgetCopyItem } from "./ledger.ts";
import type { Budget, BudgetCarried, Category } from "./types";

/** The line under READY TO ASSIGN, from the API's `unassigned` (closing balance minus the envelopes). */
export function readyLine(unassigned: number): string {
  if (unassigned > 0) return "give every rupee a job";
  return unassigned === 0 ? "every rupee has a job" : "you assigned more than you have";
}

/** The assigned amount that brings an overspent category back to ₹0 available; null when it isn't overspent. */
export function coverAmount(assigned: number, available: number): number | null {
  return available < 0 ? assigned - available : null;
}

export type BudgetProgress = {
  /** 0-100, for the bar: a bar never grows past its track. */
  barPercent: number;
  /** The true percent, e.g. 125 for "125% used"; null when there is no budget to divide by. */
  usedPercent: number | null;
  over: boolean;
  /** Minor units left (never negative) or over by (never negative). */
  left: number;
  overBy: number;
};

export function budgetProgress(budget: Pick<Budget, "budgeted_amount" | "spent">): BudgetProgress {
  const spent = budget.spent ?? 0;
  const budgeted = budget.budgeted_amount;
  const over = spent > budgeted; // decided on the integers, not on a rounded percent
  const usedPercent = budgeted > 0 ? Math.round((spent * 100) / budgeted) : null;
  return {
    barPercent: over ? 100 : Math.min(100, usedPercent ?? 0),
    usedPercent,
    over,
    left: Math.max(0, budgeted - spent),
    overBy: Math.max(0, spent - budgeted),
  };
}

/** The Budget list: every budget of the month, the most assigned first (ties by name). */
export function byAssigned<T extends Pick<Budget, "budgeted_amount" | "category">>(budgets: readonly T[]): T[] {
  return [...budgets].sort((a, b) => b.budgeted_amount - a.budgeted_amount || (a.category ?? "").localeCompare(b.category ?? ""));
}

export type BudgetRowState = {
  /** left: money still available; done: exactly used up (or nothing assigned); over: overspent. */
  kind: "left" | "done" | "over";
  /** The AVAILABLE pill: "₹260", "₹0", "−₹1,200". */
  available: string;
  /** Under the bar: "₹1,240 of ₹1,500 spent", "fully spent", "overspent by ₹1,200". */
  line: string;
  barPercent: number;
};

function signedMoney(minor: number, money: (minor: number) => string): string {
  return `${minor < 0 ? "−" : "+"}${money(Math.abs(minor))}`;
}

/**
 * A row in words. The pill is the money available (carried in plus this month's budget minus this
 * month's spending); the bar and "X of Y spent" are this month's alone, so a big carry-over cannot
 * make heavy spending look small. The carry-over is named at the end of the line.
 */
function rowState(assigned: number, spent: number, carried: number, available: number, money: (minor: number) => string): BudgetRowState {
  // The bar measures this month's spending against this month's budget; with none, against the money carried in.
  const base = assigned > 0 ? assigned : Math.max(carried, 0);
  const barPercent = base > 0 ? budgetProgress({ budgeted_amount: base, spent }).barPercent : available < 0 ? 100 : 0;
  const tail = carried !== 0 ? ` · ${signedMoney(carried, money)} carried` : "";
  if (available < 0) return { kind: "over", available: `−${money(-available)}`, line: `overspent by ${money(-available)}${tail}`, barPercent };
  if (available === 0) {
    const used = assigned > 0 || spent > 0 || carried !== 0;
    return { kind: "done", available: money(0), line: `${used ? "fully spent" : "nothing assigned"}${tail}`, barPercent };
  }
  const used = assigned > 0 ? `${money(spent)} of ${money(assigned)} spent` : spent > 0 ? `${money(spent)} spent` : "nothing assigned";
  return { kind: "left", available: money(available), line: `${used}${tail}`, barPercent };
}

/** One Budget row. An API without rollover fields falls back to this month's budget minus this month's spending. */
export function budgetRow(
  budget: Pick<Budget, "budgeted_amount" | "spent"> & Partial<Pick<Budget, "carried_in" | "available">>,
  money: (minor: number) => string
): BudgetRowState {
  const spent = budget.spent ?? 0;
  const available = budget.available ?? budget.budgeted_amount - spent;
  return rowState(budget.budgeted_amount, spent, budget.carried_in ?? 0, available, money);
}

/** The row of a category that carries money but has no budget this month. */
export function carriedRow(row: Pick<BudgetCarried, "carried_in" | "spent" | "available">, money: (minor: number) => string): BudgetRowState {
  return rowState(0, row.spent, row.carried_in, row.available, money);
}

/** Active expense categories that have no budget yet this month. */
export function unbudgetedCategories(categories: readonly Category[], budgets: readonly Pick<Budget, "category_id">[]): Category[] {
  const budgeted = new Set(budgets.map((budget) => budget.category_id));
  return categories.filter((category) => category.is_active && category.type === "expense" && !budgeted.has(category.id));
}

export type CopyRun = {
  copied: number;
  failed: number;
  /** Items never attempted because the run stopped early. */
  notTried: number;
  stopped: boolean;
};

/**
 * Writes the planned budgets one at a time (staying under the API's per-minute
 * limit). One failure does not abort the run; `shouldStop` marks the errors that
 * make continuing pointless (rate limited, signed out), and whatever was done up
 * to then is reported instead of being lost.
 */
export async function copyBudgets(
  items: readonly BudgetCopyItem[],
  write: (item: BudgetCopyItem) => Promise<unknown>,
  shouldStop: (error: unknown) => boolean
): Promise<CopyRun> {
  const run: CopyRun = { copied: 0, failed: 0, notTried: 0, stopped: false };
  for (const [index, item] of items.entries()) {
    try {
      await write(item);
      run.copied += 1;
    } catch (error) {
      run.failed += 1;
      if (shouldStop(error)) {
        run.stopped = true;
        run.notTried = items.length - index - 1;
        break;
      }
    }
  }
  return run;
}

/** "Copied 8 · skipped 2 · failed 1", with a note when the run stopped early. */
export function copySummary(run: CopyRun, skipped: number): string {
  const line = `Copied ${run.copied} · skipped ${skipped} · failed ${run.failed}`;
  return run.stopped ? `${line} · ${run.notTried} not tried (stopped early)` : line;
}
