// Pure report maths for the Reports screen: the 6-month window and its bar scale, percent changes,
// the daily average, the savings wording and the category grouping. Every amount is an integer in
// minor units (rule 3). Import-free except sibling `.ts` value imports, so `node --test` runs it
// without a bundler.

import { monthShift, type MonthYear } from "./dates.ts";
import { compactMoney } from "./home.ts";
import { sumMinor } from "./money.ts";
import type { CategorySpending, MonthlySummary, PaymentMethodSpending } from "./types";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINUS = "−"; // a real minus sign, as the design draws it

/** Short label for a month, e.g. "Apr". */
export function monthLabel({ month }: MonthYear): string {
  return MONTH_ABBR[month - 1];
}

/** "Sep 2026". */
export function monthYear({ month, year }: MonthYear): string {
  return `${MONTH_ABBR[month - 1]} ${year}`;
}

/** What a month is called on the pill and in its sheet: "this month", "last month", then "Jul 2026". */
export function periodLabel(m: MonthYear, now: MonthYear): string {
  const back = (now.year - m.year) * 12 + (now.month - m.month);
  return back === 0 ? "this month" : back === 1 ? "last month" : monthYear(m);
}

/** `count` months ending at (and including) `to`, oldest first. */
export function lastMonths(to: MonthYear, count: number): MonthYear[] {
  return Array.from({ length: count }, (_, i) => monthShift(to.month, to.year, i - (count - 1)));
}

export type BarPair = { incomePercent: number; spendPercent: number };

/**
 * Each month's income/spend column height as a share (0-100) of the largest
 * value across the whole history, so every column reads off the same scale.
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

/** Percent change from `previous` to `current`, to one decimal; null when there was no `previous` to compare with (amounts are never negative). */
export function percentChange(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) * 1000) / previous) / 10;
}

/** "+7.5%" or "−2.4%"; "—" when there is no percent. */
export function signedPercent(percent: number | null): string {
  if (percent === null) return "—";
  return `${percent > 0 ? "+" : percent < 0 ? MINUS : ""}${Math.abs(percent)}%`;
}

/** "↑ 7.5%", "↓ 2.4%", "→ 0%"; "—" when there is no percent. */
export function arrowPercent(percent: number | null): string {
  if (percent === null) return "—";
  return `${percent > 0 ? "↑" : percent < 0 ? "↓" : "→"} ${Math.abs(percent)}%`;
}

export type Trend = "good" | "bad" | "flat";

/** Whether a move is good news: more income and more saved are, more spending is not. No move, or nothing to compare with, is flat. */
export function trend(delta: number | null, goodWhenUp: boolean): Trend {
  if (!delta) return "flat";
  return delta > 0 === goodWhenUp ? "good" : "bad";
}

/** A signed short amount for a tile: "+₹3.2K", "−₹1.1K", "₹0". */
export function signedCompact(minor: number, currency: string): string {
  return `${minor > 0 ? "+" : minor < 0 ? MINUS : ""}${compactMoney(minor, currency)}`;
}

/** How many days a month's daily average is spread over: the days so far for the running month (`today` is "YYYY-MM-DD"), all of them for a past one. */
export function daysCounted({ month, year }: MonthYear, today: string): number {
  const [y, m, d] = today.split("-").map(Number);
  return y === year && m === month ? d : new Date(year, month, 0).getDate();
}

/** Average spend per day, rounded to a whole currency unit like the design's "₹1,071". */
export function dailyAverage(spent: number, days: number): number {
  return days > 0 ? Math.round(spent / days / 100) * 100 : 0;
}

/** Change in the daily average against the previous month's, to one decimal (null: nothing to compare with). Cross-multiplied so the averages are never rounded first. */
export function dailyChange(spent: number, days: number, prevSpent: number, prevDays: number): number | null {
  return percentChange(spent * prevDays, prevSpent * days);
}

/** The savings card's two lines, honest at the edges: no income to save from, or more spent than came in. */
export function keptLine(income: number, expenses: number): string {
  if (income <= 0) return "No income\nlogged";
  const net = income - expenses;
  if (net >= 0) return `You kept\n${Math.round((net * 100) / income)}% of it`;
  const spent = Math.round((expenses * 100) / income);
  return `You spent\n${spent > 999 ? "999%+" : `${spent}%`} of it`;
}

/** The tag over the chosen column: "₹17,860 saved" or "₹2,000 overspent"; null when nothing was logged. `money` formats minor units. */
export function savedBadge(income: number, expenses: number, money: (minor: number) => string): string | null {
  if (income === 0 && expenses === 0) return null;
  const net = income - expenses;
  return net >= 0 ? `${money(net)} saved` : `${money(-net)} overspent`;
}

/** "1 txn", "14 txns". */
export function txnLabel(count: number): string {
  return `${count} txn${count === 1 ? "" : "s"}`;
}

export type Share = { key: string; name: string; color: string | null; amount: number; count: number; percent: number; other: boolean };

/**
 * A month's spending for the breakdown: the `top` biggest categories, then the rest summed into "Other".
 * A tail of one keeps its own name (an "Other" that is really one category would hide it), so "Other" always
 * stands for two or more. Zero amounts are dropped; each percent is of the month's whole spending.
 */
export function categoryShares(
  rows: readonly Pick<CategorySpending, "category_id" | "category" | "color" | "amount" | "transaction_count">[],
  top = 4,
): Share[] {
  const spent = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sumMinor(spent.map((r) => r.amount));
  const percent = (amount: number) => (total > 0 ? (amount * 100) / total : 0);
  const named = spent.length > top + 1 ? spent.slice(0, top) : spent;
  const rest = spent.slice(named.length);

  const shares: Share[] = named.map((r) => ({
    key: r.category_id,
    name: r.category,
    color: r.color,
    amount: r.amount,
    count: r.transaction_count,
    percent: percent(r.amount),
    other: false,
  }));
  if (rest.length > 0) {
    const amount = sumMinor(rest.map((r) => r.amount));
    shares.push({ key: "other", name: "Other", color: null, amount, count: sumMinor(rest.map((r) => r.transaction_count)), percent: percent(amount), other: true });
  }
  return shares;
}

export type MethodShare = { key: string; method: string | null; percent: number };

/** A month's spending by payment method, biggest first, each as a percent of the whole (`method` null = transactions with none set). */
export function methodShares(rows: readonly Pick<PaymentMethodSpending, "payment_method" | "amount">[]): MethodShare[] {
  const spent = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sumMinor(spent.map((r) => r.amount));
  return spent.map((r) => ({ key: r.payment_method ?? "none", method: r.payment_method, percent: (r.amount * 100) / total }));
}
