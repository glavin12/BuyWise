// Budget maths as pure functions: what is left to assign, how far a category is
// through its budget, which categories still have none, and the sequential
// "copy from last month" runner. Type-only imports plus explicit .ts siblings
// so `npm test` can run it. Every figure is an integer in minor units.

import type { BudgetCopyItem } from "./ledger.ts";
import type { Budget, Category, CategorySpending } from "./types";

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

/** One envelope on the Budget screen: a category, its budget (null when it has none) and this month's spending. */
export type Envelope = {
  categoryId: string;
  name: string;
  budget: Budget | null;
  /** Minor units. */
  spent: number;
  count: number;
  /** The budget's category has since been archived. */
  archived: boolean;
};

/**
 * The Budget screen's envelopes: every budget of the month (in API order), then the unbudgeted
 * active expense categories that have spending this month, most spent first. `rest` is every
 * other unbudgeted category (the "N more" tab). Without `categories` (not loaded) only the
 * budgets are known.
 */
export function envelopesFor(
  budgets: readonly Budget[],
  spending: readonly CategorySpending[],
  categories: readonly Category[] | undefined,
): { envelopes: Envelope[]; rest: Category[] } {
  const byCategory = new Map(spending.map((row) => [row.category_id, row]));
  const active = categories ? new Set(categories.filter((c) => c.is_active).map((c) => c.id)) : null;
  const budgeted = budgets.map((budget) => ({
    categoryId: budget.category_id,
    name: budget.category ?? "Unknown category",
    budget,
    spent: budget.spent ?? 0,
    count: byCategory.get(budget.category_id)?.transaction_count ?? 0,
    archived: active ? !active.has(budget.category_id) : false,
  }));
  const open = categories ? unbudgetedCategories(categories, budgets) : [];
  const spentIn = open
    .filter((category) => (byCategory.get(category.id)?.amount ?? 0) > 0)
    .map((category) => {
      const row = byCategory.get(category.id);
      return { categoryId: category.id, name: category.name, budget: null, spent: row?.amount ?? 0, count: row?.transaction_count ?? 0, archived: false };
    })
    .sort((a, b) => b.spent - a.spent);
  const shown = new Set(spentIn.map((envelope) => envelope.categoryId));
  return { envelopes: [...budgeted, ...spentIn], rest: open.filter((category) => !shown.has(category.id)) };
}

/** The envelope in front: the one picked, else the one with the most spent (the first on a tie). */
export function frontEnvelope(envelopes: readonly Envelope[], pickedId: string | null): Envelope | undefined {
  return envelopes.find((e) => e.categoryId === pickedId) ?? envelopes.reduce<Envelope | undefined>((best, e) => (!best || e.spent > best.spent ? e : best), undefined);
}

export type EnvelopeStatus = { kind: "done" | "over" | "progress" | "unset" | "more"; text: string };

/**
 * A back tab's state, in words (its colour only reinforces them): "125% · over ₹1,200",
 * "₹18,000 / 18,000" (done when nothing is left), or "not budgeted".
 */
export function envelopeStatus(envelope: Envelope, money: (minor: number) => string): EnvelopeStatus {
  const { budget } = envelope;
  if (!budget) return { kind: "unset", text: "not budgeted" };
  const progress = budgetProgress(budget);
  if (progress.over) {
    const over = `over ${money(progress.overBy)}`;
    return { kind: "over", text: progress.usedPercent === null ? over : `${progress.usedPercent}% · ${over}` };
  }
  const text = `${money(envelope.spent)} / ${money(budget.budgeted_amount).replace(/^[^\d]+/, "")}`;
  return { kind: budget.budgeted_amount > 0 && progress.left === 0 ? "done" : "progress", text };
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
