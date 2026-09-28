// Budget maths as pure functions: what is left to assign, how far a category is
// through its budget, which categories still have none, and the sequential
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

/** "₹1,200 left · 60% used" or "Over by ₹500 · 125% used": the words carry the meaning, colour only reinforces it. */
export function budgetStatusText(progress: BudgetProgress, money: (minor: number) => string): string {
  const head = progress.over ? `Over by ${money(progress.overBy)}` : `${money(progress.left)} left`;
  return progress.usedPercent === null ? head : `${head} · ${progress.usedPercent}% used`;
}

/** Active expense categories that have no budget yet this month. */
export function unbudgetedCategories(categories: readonly Category[], budgets: readonly Pick<Budget, "category_id">[]): Category[] {
  const budgeted = new Set(budgets.map((budget) => budget.category_id));
  return categories.filter((category) => category.is_active && category.type === "expense" && !budgeted.has(category.id));
}

/** A budget whose category has since been deactivated (it is no longer in the active expense list). */
export function isArchivedBudget(budget: Pick<Budget, "category_id">, activeExpenseIds: ReadonlySet<string>): boolean {
  return !activeExpenseIds.has(budget.category_id);
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
