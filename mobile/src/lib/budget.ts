// Budget maths as pure functions: what is left to assign, how far a category is
// through its budget (and its row in words), which categories still have none, and the sequential
// "copy from last month" runner. Type-only imports plus explicit .ts siblings
// so `npm test` can run it. Every figure is an integer in minor units.

import type { BudgetCopyItem } from "./ledger.ts";
import type { Budget, Category } from "./types";

/** Income minus everything assigned to category budgets. Negative means over-assigned. */
export function readyToAssign(income: number, budgets: readonly Pick<Budget, "budgeted_amount">[]) {
  const assigned = budgets.reduce((total, budget) => total + budget.budgeted_amount, 0);
  return { income, assigned, ready: income - assigned };
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

/** One Budget row in words. Available is this month's budget minus this month's spending (no carry-over). */
export function budgetRow(budget: Pick<Budget, "budgeted_amount" | "spent">, money: (minor: number) => string): BudgetRowState {
  const progress = budgetProgress(budget);
  if (progress.over) {
    return { kind: "over", available: `−${money(progress.overBy)}`, line: `overspent by ${money(progress.overBy)}`, barPercent: 100 };
  }
  if (progress.left === 0) {
    const assigned = budget.budgeted_amount > 0;
    return { kind: "done", available: money(0), line: assigned ? "fully spent" : "nothing assigned", barPercent: assigned ? 100 : 0 };
  }
  const spent = money(budget.spent ?? 0);
  return { kind: "left", available: money(progress.left), line: `${spent} of ${money(budget.budgeted_amount)} spent`, barPercent: progress.barPercent };
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
