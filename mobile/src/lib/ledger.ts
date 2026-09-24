// Pure ledger logic: grouping, paging, diffing and budget-copy planning.
// Import-free (types only) so `npm test` runs it, and every total is an
// integer sum of minor units: display_* floats are never added together.

import type { Budget, Transaction } from "./types";

// ── Transaction list ────────────────────────────────────────────

export type DaySection = {
  /** "YYYY-MM-DD" */
  date: string;
  /** income minus expenses in minor units; starting balances are labelled, not counted */
  net: number;
  data: Transaction[];
};

/** Groups rows (already newest-first) by calendar day. A day split across pages is one section. */
export function groupByDay(rows: readonly Transaction[]): DaySection[] {
  const sections = new Map<string, DaySection>();
  for (const row of rows) {
    let section = sections.get(row.transaction_date);
    if (!section) {
      section = { date: row.transaction_date, net: 0, data: [] };
      sections.set(row.transaction_date, section);
    }
    section.data.push(row);
    if (row.transaction_type === "income") section.net += row.amount;
    else if (row.transaction_type === "expense") section.net -= row.amount;
  }
  return [...sections.values()];
}

/**
 * Flattens fetched pages into one list, keeping the first copy of any repeated
 * id: offset paging can repeat a row when the data shifts between two fetches.
 */
export function flattenPages(pages: readonly { transactions: readonly Transaction[] }[]): Transaction[] {
  const seen = new Set<string>();
  const rows: Transaction[] = [];
  for (const page of pages) {
    for (const tx of page.transactions) {
      if (seen.has(tx.id)) continue;
      seen.add(tx.id);
      rows.push(tx);
    }
  }
  return rows;
}

/** Client-side search over the loaded rows: payee, description, notes and category. */
export function matchesSearch(tx: Transaction, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [tx.payee, tx.description, tx.notes, tx.category].some((field) => field?.toLowerCase().includes(needle));
}

/**
 * Maps every row of a cached infinite list. Returning null from `fn` removes the
 * row (and lowers each page's `total` so paging stays consistent).
 */
export function mapPages<D extends { pages: { transactions: Transaction[]; total: number }[] }>(
  data: D,
  fn: (tx: Transaction) => Transaction | null
): D {
  let removed = 0;
  const pages = data.pages.map((page) => {
    const transactions: Transaction[] = [];
    for (const tx of page.transactions) {
      const next = fn(tx);
      if (next) transactions.push(next);
      else removed += 1;
    }
    return { ...page, transactions };
  });
  // `total` is the whole result count, repeated on every page.
  return { ...data, pages: pages.map((page) => ({ ...page, total: page.total - removed })) };
}

/** Finds a row in any cached list page (used to open the detail screen instantly). */
export function findInPages(
  lists: readonly ({ pages: { transactions: readonly Transaction[] }[] } | undefined)[],
  id: string
): Transaction | undefined {
  for (const list of lists) {
    for (const page of list?.pages ?? []) {
      const found = page.transactions.find((tx) => tx.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

// ── Forms ───────────────────────────────────────────────────────

/**
 * The fields of `current` that differ from `initial` (a PATCH body). An empty
 * result means nothing changed, so Save stays disabled. Sending only what
 * changed also avoids re-sending an unchanged but since-deactivated
 * category_id, which the backend rejects.
 */
export function diffFields<T extends object>(initial: T, current: T): Partial<T> {
  const diff: Partial<T> = {};
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (!Object.is(initial[key], current[key])) diff[key] = current[key];
  }
  return diff;
}

// ── Budget copy ─────────────────────────────────────────────────

export type BudgetCopyItem = { category_id: string; category: string | null; budgeted_amount: number };
export type BudgetCopyPlan = {
  copy: BudgetCopyItem[];
  skipped: number;
  reasons: { already_set: number; inactive: number };
};

/**
 * What "Copy from last month" will do. It never overwrites a budget already set
 * this month and skips categories that are no longer active expense
 * categories, so nothing fails on a rule the app can check up front.
 */
export function planBudgetCopy(
  lastMonth: readonly Budget[],
  thisMonth: readonly Budget[],
  activeExpenseIds: ReadonlySet<string>
): BudgetCopyPlan {
  const alreadySet = new Set(thisMonth.map((budget) => budget.category_id));
  const plan: BudgetCopyPlan = { copy: [], skipped: 0, reasons: { already_set: 0, inactive: 0 } };
  for (const budget of lastMonth) {
    if (alreadySet.has(budget.category_id)) {
      plan.reasons.already_set += 1;
    } else if (!activeExpenseIds.has(budget.category_id)) {
      plan.reasons.inactive += 1;
    } else {
      plan.copy.push({
        category_id: budget.category_id,
        category: budget.category,
        budgeted_amount: budget.budgeted_amount,
      });
    }
  }
  plan.skipped = plan.reasons.already_set + plan.reasons.inactive;
  return plan;
}
