// Pure report maths for the Reports screen: the 6-month trend window, savings
// rate and its average, and the summary lines shown on cards. Mirrors the
// web's rules (frontend/app/(dashboard)/reports/page.tsx) so both clients read
// the same numbers the same way. Import-free except sibling `.ts` value
// imports, so `node --test` runs it without a bundler.

import { monthShift, type MonthYear } from "./dates.ts";
import type { CategorySpending, MonthlySummary } from "./types";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short label for a month, e.g. "Apr". */
export function monthLabel({ month }: MonthYear): string {
  return MONTH_ABBR[month - 1];
}

/** `count` months ending at (and including) `to`, oldest first. */
export function lastMonths(to: MonthYear, count: number): MonthYear[] {
  return Array.from({ length: count }, (_, i) => monthShift(to.month, to.year, i - (count - 1)));
}

/** Net as a percent of income; null when there was no income to save from (income <= 0). */
export function savingsRate(summary: Pick<MonthlySummary, "income" | "net">): number | null {
  return summary.income > 0 ? (summary.net / summary.income) * 100 : null;
}

/**
 * Average savings rate over the months that had income. Matches the web's
 * rule: fewer than two such months isn't a meaningful average.
 */
export function averageRate(history: readonly Pick<MonthlySummary, "income" | "net">[]): number | null {
  const rates = history.filter((h) => h.income > 0).map((h) => savingsRate(h) as number);
  return rates.length < 2 ? null : rates.reduce((a, b) => a + b, 0) / rates.length;
}

/** "34% saved, 6 points above your 6-month average", with sensible text at the edges. */
export function rateInsight(current: number | null, avg: number | null): string {
  if (current === null) return "Add income this month to see your savings rate.";
  const saved = `${Math.round(current)}% saved`;
  if (avg === null) return `${saved} this month.`;
  const diff = Math.round(current - avg);
  if (diff === 0) return `${saved}, in line with your 6-month average.`;
  return `${saved}, ${Math.abs(diff)} points ${diff > 0 ? "above" : "below"} your 6-month average.`;
}

/** "{category} leads at X% of spend", or null when there is nothing to lead. */
export function topCategory(list: readonly Pick<CategorySpending, "category" | "percent_of_total">[]): string | null {
  if (list.length === 0) return null;
  const top = list.reduce((a, b) => (b.percent_of_total > a.percent_of_total ? b : a));
  return `${top.category} leads at ${Math.round(top.percent_of_total)}% of spend`;
}

export type BarPair = { incomePercent: number; spendPercent: number };

/**
 * Each month's income/spend bar height as a share (0-100) of the largest
 * value across the whole history, so every bar reads off the same scale.
 * Integer maths on minor units only (rule 3); all zero when nothing happened.
 */
export function barPercents(history: readonly Pick<MonthlySummary, "income" | "expenses">[]): BarPair[] {
  const max = Math.max(0, ...history.flatMap((h) => [h.income, h.expenses]));
  if (max === 0) return history.map(() => ({ incomePercent: 0, spendPercent: 0 }));
  return history.map((h) => ({
    incomePercent: Math.round((h.income * 100) / max),
    spendPercent: Math.round((h.expenses * 100) / max),
  }));
}
