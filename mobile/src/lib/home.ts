// Home screen maths as pure functions: the Spend Pulse week (daily expense totals,
// their % of the daily budget, the top categories) and the money strings the design
// shows (a hero amount split from its fraction, compact tile amounts, the balance
// card's In / Out / Net). Type-only imports plus explicit .ts siblings so `npm test` can run it.
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

export type SafeToSpend =
  /** No budget this month (or budgets of 0): nothing to share out. */
  | { kind: "none" }
  /** The month's budget is spent (`overBy` 0) or overspent. */
  | { kind: "over"; overBy: number; days: number; usedPercent: number; monthPercent: number }
  /** The budget has room, but the balance is 0 or less: there is no money to spend. */
  | { kind: "empty"; days: number; usedPercent: number; monthPercent: number }
  /** `left` is shared over `days`: the budget's (`budgetLeft`), or the balance when that is lower (`byBalance`). */
  | { kind: "ok"; perDay: number; left: number; budgetLeft: number; byBalance: boolean; days: number; usedPercent: number; monthPercent: number; ahead: boolean };

/**
 * Home's "Safe to spend today": what is left of this month's budget (the dashboard's `remaining_budget`: the month's
 * budgets minus all of its spending; money carried over from earlier months is not in it), but never more than the
 * money actually in hand (`current_balance`, which income and starting balances raise and every expense lowers),
 * shared over the days left, today included (`days_remaining_in_month` leaves today out). Rounded down, so it never
 * offers more than is left. `usedPercent` is the month's spending against its budgets, `monthPercent` how much of the
 * month has gone (today included), and `ahead` says spending is running faster than the month, decided on the integers.
 */
export function safeToSpend(
  d: Pick<DashboardData, "has_budget" | "total_budgeted" | "total_spent" | "remaining_budget" | "current_balance" | "days_remaining_in_month">,
  month: number,
  year: number,
): SafeToSpend {
  if (!d.has_budget || d.total_budgeted <= 0) return { kind: "none" };
  const length = new Date(year, month, 0).getDate();
  const gone = Math.max(1, Math.min(length, length - d.days_remaining_in_month));
  const days = length - gone + 1;
  const usedPercent = Math.round((d.total_spent * 100) / d.total_budgeted);
  const monthPercent = Math.round((gone * 100) / length);
  if (d.remaining_budget <= 0) return { kind: "over", overBy: Math.max(0, -d.remaining_budget), days, usedPercent, monthPercent }; // never −0
  if (d.current_balance <= 0) return { kind: "empty", days, usedPercent, monthPercent };
  const left = Math.min(d.remaining_budget, d.current_balance);
  return {
    kind: "ok",
    perDay: Math.floor(left / days),
    left,
    budgetLeft: d.remaining_budget,
    byBalance: left < d.remaining_budget,
    days,
    usedPercent,
    monthPercent,
    ahead: d.total_spent * length > d.total_budgeted * gone,
  };
}

/** The Safe to spend card's badge: "10 days left", today counted; "last day" on the month's last. */
export function daysLeft(days: number): string {
  return days === 1 ? "last day" : `${days} days left`;
}

/** The line under the Safe to spend figure. `money` formats an unsigned amount in minor units. */
export function safeLine(s: SafeToSpend, money: (minor: number) => string): string {
  if (s.kind === "none") return "Set a budget for this month to see what you can spend each day.";
  if (s.kind === "over") return s.overBy > 0 ? `${money(s.overBy)} over this month's budget.` : "This month's budget is all spent.";
  if (s.kind === "empty") return "Your balance is empty, so nothing is safe to spend.";
  if (s.byBalance) return `Capped by your balance: ${money(s.left)} in hand, ${money(s.budgetLeft)} left in your budget.`;
  return `${s.ahead ? "Spending faster than the month" : "On track"}: ${money(s.left)} left in your budget.`;
}

export type MonthFigure = { label: string; value: string; tone: "text" | "mint" | "tomato" };

/**
 * The balance card's In / Out / Net for the dashboard's month (`month` is its short name, "Oct"). In is mint (money
 * in); Net is signed, mint when up and tomato when down. `money` formats an unsigned amount in minor units.
 */
export function monthFigures(
  d: Pick<DashboardData, "total_income" | "total_spent" | "net">,
  month: string,
  money: (minor: number) => string,
): MonthFigure[] {
  const sign = d.net > 0 ? "+" : d.net < 0 ? "−" : "";
  return [
    { label: `In · ${month}`, value: money(d.total_income), tone: "mint" },
    { label: "Out", value: money(d.total_spent), tone: "text" },
    { label: "Net", value: `${sign}${money(Math.abs(d.net))}`, tone: d.net > 0 ? "mint" : d.net < 0 ? "tomato" : "text" },
  ];
}
