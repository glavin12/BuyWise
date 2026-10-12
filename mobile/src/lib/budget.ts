// Budget maths as pure functions: the line under "left to budget", how far a category is
// through its budget (and its row in words and its place in the list, rolled-over money included),
// the month's four figures, which categories still have none, and the sequential "copy from last
// month" runner. Type-only imports plus explicit .ts siblings so `npm test` can run it. Every figure
// is an integer in minor units. What is left to budget (`unassigned`) and each category's money left
// (`available`) are worked out by the API. The words are the plain ones (UX review, 2026-10-04):
// "Left to budget", "Budgeted" and "Left" for the API's unassigned, budgeted_amount and available.

import type { BudgetCopyItem } from "./ledger.ts";
import type { Budget, BudgetCarried, Category } from "./types";

/** The line under LEFT TO BUDGET, from the API's `unassigned` (closing balance minus the money in every budget). */
export function readyLine(unassigned: number): string {
  if (unassigned > 0) return "Money you have that isn't in a budget yet.";
  return unassigned === 0 ? "All your money is budgeted." : "You budgeted more than you have.";
}

/** The budgeted amount that brings an overspent category back to ₹0 left; null when it isn't overspent. */
export function coverAmount(budgeted: number, available: number): number | null {
  return available < 0 ? budgeted - available : null;
}

/** A row counts as nearly spent once this much of its money is used. */
const NEAR_PERCENT = 75;

export type BudgetRowState = {
  /** over: overspent; near: 75% or more of its money used; left: money left; done: all of it spent (or none to spend). */
  kind: "over" | "near" | "left" | "done";
  /** The row's one figure, unsigned: what is left, or how much it is over by. */
  figure: string;
  word: "left" | "over";
  /** Under the name: "₹6,300 of ₹8,000 spent", then "+₹500 from Sep" when money was carried in (minus: an earlier overspend). */
  line: string;
  /** Spent against everything the category had (carried in plus budgeted), 0-100, so the bar agrees with the figure. */
  barPercent: number;
  /** Money left, negative when over: the API's `available`. */
  available: number;
};

/**
 * A row in words. Everything the category had this month is what earlier months left it (or minus what they
 * overspent) plus this month's budget, so `available + spent`: the bar fills by spending against that, and the
 * figure is what is left of it, so the two always agree. "X of Y spent" names this month's budget; the carry-over,
 * when there is one, is named after it with the month it came from (`from`, "Sep").
 */
function rowState(budgeted: number, spent: number, carried: number, available: number, money: (minor: number) => string, from: string): BudgetRowState {
  const had = available + spent;
  const barPercent = had > 0 ? Math.min(100, Math.round((spent * 100) / had)) : available < 0 ? 100 : 0;
  // Decided on the integers, not on the rounded percent.
  const kind = available < 0 ? "over" : available === 0 ? "done" : spent * 100 >= NEAR_PERCENT * had ? "near" : "left";
  const used = budgeted > 0 ? `${money(spent)} of ${money(budgeted)} spent` : spent > 0 ? `${money(spent)} spent` : "nothing spent";
  const carry = carried !== 0 ? ` · ${carried > 0 ? "+" : "−"}${money(Math.abs(carried))} from ${from}` : "";
  return { kind, figure: money(Math.abs(available)), word: available < 0 ? "over" : "left", line: `${used}${carry}`, barPercent, available };
}

/** One Budget row. An API without rollover fields falls back to this month's budget minus this month's spending. */
export function budgetRow(
  budget: Pick<Budget, "budgeted_amount" | "spent"> & Partial<Pick<Budget, "carried_in" | "available">>,
  money: (minor: number) => string,
  from: string,
): BudgetRowState {
  const spent = budget.spent ?? 0;
  const available = budget.available ?? budget.budgeted_amount - spent;
  return rowState(budget.budgeted_amount, spent, budget.carried_in ?? 0, available, money, from);
}

/** The row of a category that carries money but has no budget this month. */
export function carriedRow(row: Pick<BudgetCarried, "carried_in" | "spent" | "available">, money: (minor: number) => string, from: string): BudgetRowState {
  return rowState(0, row.spent, row.carried_in, row.available, money, from);
}

const ATTENTION = { over: 0, near: 1, left: 2, done: 3 } as const;

/** The Budget list in the order it needs you: overspent, nearly spent, the rest, then finished; in each, the least left first, then by name. */
export function byAttention<T extends { name: string; state: Pick<BudgetRowState, "kind" | "available"> }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => ATTENTION[a.state.kind] - ATTENTION[b.state.kind] || a.state.available - b.state.available || a.name.localeCompare(b.name),
  );
}

export type FlowFigure = { label: string; value: string; tone: "text" | "mint" | "tomato" };

/**
 * The month as four figures that add up left to right: the balance it started at, money in, money out, and the
 * balance now (`current`) or at its end. "In" is worked out from the other three (closing − opening + spent), so a
 * starting balance logged that month counts as money in and the row always adds up. `money` is unsigned.
 */
export function monthFlow(opening: number, closing: number, spent: number, current: boolean, money: (minor: number) => string): FlowFigure[] {
  const signed = (minor: number) => `${minor < 0 ? "−" : ""}${money(Math.abs(minor))}`;
  const came = closing - opening + spent;
  return [
    { label: "Started", value: signed(opening), tone: opening < 0 ? "tomato" : "text" },
    { label: "In", value: came > 0 ? `+${money(came)}` : signed(came), tone: "mint" },
    { label: "Out", value: spent > 0 ? `−${money(spent)}` : money(0), tone: "text" },
    { label: current ? "Now" : "End", value: signed(closing), tone: closing < 0 ? "tomato" : "text" },
  ];
}

/** How much of the month has gone, today included, as a whole %; null unless `today` (YYYY-MM-DD) is in that month. */
export function monthGone(today: string, month: number, year: number): number | null {
  const [y, m, d] = today.split("-").map(Number);
  if (y !== year || m !== month) return null;
  return Math.round((d * 100) / new Date(year, month, 0).getDate());
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
