// Home screen maths as pure functions: the Spend Pulse week (daily expense totals,
// their % of the daily budget, the top categories) and the money strings the design
// shows (a hero amount split from its fraction, compact tile amounts, the balance
// sentence). Type-only imports plus explicit .ts siblings so `npm test` can run it.
// Every amount is an integer in minor units unless its name says `display`.

import { parseDateOnly, shiftDays } from "./dates.ts";
import type { DashboardData, Transaction } from "./types";

/** The 7 "YYYY-MM-DD" days, Monday first, of the week containing `today`, moved back `weeksBack` weeks. */
export function weekOf(today: string, weeksBack = 0): string[] {
  const date = parseDateOnly(today);
  const sinceMonday = date ? (date.getDay() + 6) % 7 : 0; // getDay: Sunday = 0
  const monday = shiftDays(today, -sinceMonday - 7 * weeksBack);
  return Array.from({ length: 7 }, (_, i) => shiftDays(monday, i));
}

/** Only rows analytics count as spending: expenses, never split children (they repeat their parent). */
function spending(txs: readonly Transaction[], categoryId?: string): Transaction[] {
  return txs.filter(
    (t) => t.transaction_type === "expense" && !t.parent_transaction_id && (!categoryId || t.category_id === categoryId),
  );
}

/** Spending per day of `days`, optionally for one category. */
export function dailySpend(txs: readonly Transaction[], days: readonly string[], categoryId?: string): number[] {
  const totals = days.map(() => 0);
  for (const t of spending(txs, categoryId)) {
    const i = days.indexOf(t.transaction_date);
    if (i >= 0) totals[i] += t.amount;
  }
  return totals;
}

export type TopCategory = { id: string; name: string; color: string | null; total: number };

/** The `n` categories with the most spending, biggest first (uncategorised rows are skipped). */
export function topCategories(txs: readonly Transaction[], n: number): TopCategory[] {
  const byId = new Map<string, TopCategory>();
  for (const t of spending(txs)) {
    if (!t.category_id) continue;
    const row = byId.get(t.category_id) ?? { id: t.category_id, name: t.category ?? "Other", color: null, total: 0 };
    row.total += t.amount;
    byId.set(t.category_id, row);
  }
  return [...byId.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

/** A month's budget spread evenly over its days. */
export function dailyBudget(monthBudget: number, month: number, year: number): number {
  const days = new Date(year, month, 0).getDate();
  return Math.round(monthBudget / days);
}

/**
 * Each day as a whole % of the daily budget; with no budget, of the week's biggest day
 * (so the pulse still reads). Capped at 999 so it fits a 34px bubble.
 */
export function pulsePercents(values: readonly number[], budgetPerDay: number): { percents: number[]; of: "budget" | "peak" } {
  const of = budgetPerDay > 0 ? "budget" : "peak";
  const base = of === "budget" ? budgetPerDay : Math.max(...values);
  return { of, percents: values.map((v) => (base > 0 ? Math.min(999, Math.round((v / base) * 100)) : 0)) };
}

/** "₹1,24,860.00" → ["₹1,24,860", ".00"]; "1.234,56 €" → ["1.234", ",56 €"]. No fraction → [text, ""]. */
export function splitFraction(formatted: string): [string, string] {
  const m = /^(.*\d)([.,]\d{2}\D*)$/.exec(formatted);
  return m ? [m[1], m[2]] : [formatted, ""];
}

/** Drops a zero fraction: "₹17,860.00" → "₹17,860", "₹12.50" stays. */
export function wholeIfRound(formatted: string): string {
  return formatted.replace(/[.,]00(?=\D*$)/, "");
}

const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
// Indian numbering for rupees (lakh, crore); thousands, millions, billions otherwise.
const STEPS: Record<string, [number, string][]> = {
  INR: [[1e7, "Cr"], [1e5, "L"], [1e3, "K"]],
  other: [[1e9, "B"], [1e6, "M"], [1e3, "K"]],
};

export const currencySymbol = (currency: string) => SYMBOL[currency] ?? currency;

/** A short unsigned amount for a small tile: ₹340, ₹12K, ₹1.2L. Whole units, one decimal when scaled. */
export function compactMoney(minor: number, currency: string): string {
  const units = Math.abs(minor) / 100;
  const symbol = SYMBOL[currency] ?? `${currency} `;
  for (const [size, suffix] of STEPS[currency === "INR" ? "INR" : "other"]) {
    if (units >= size) return `${symbol}${Number((units / size).toFixed(1))}${suffix}`;
  }
  return `${symbol}${Math.round(units)}`;
}

/**
 * The balance card's sentence as a RichText template: the month's net, then the budget
 * (ready to assign / over / left / none yet), then the goals. `@budget` and `@goals`
 * chips are links. `money` formats a display amount.
 */
export function balanceSentence(d: DashboardData, periodLabel: string, money: (display: number) => string): string {
  const net =
    d.net > 0
      ? `Up {mint:+${money(d.display_net)}} ${periodLabel}.`
      : d.net < 0
        ? `Down {coral:−${money(Math.abs(d.display_net))}} ${periodLabel}.`
        : `Even ${periodLabel}.`;

  const budget = !d.has_budget
    ? "No budget yet: {hi@budget:set one}."
    : d.unassigned > 0
      ? `{hi@budget:${money(d.display_unassigned)}} is ready to assign.`
      : d.remaining_budget < 0
        ? `{coral@budget:${money(Math.abs(d.display_remaining_budget))}} over budget.`
        : `{hi@budget:${money(d.display_remaining_budget)}} left to spend.`;

  const n = d.active_goals_count;
  const goals = n > 0 ? `{dark@goals:${n} goal${n === 1 ? "" : "s"}} in progress.` : "No goals yet: {dark@goals:add one}.";

  return `${net} ${budget} ${goals}`;
}
