// Calendar-date helpers. The API's transaction_date is a calendar DATE
// ("YYYY-MM-DD"), so everything here works in the device's LOCAL calendar and
// never round-trips through UTC: `toISOString().slice(0, 10)` is the UTC date,
// which is yesterday for a user in India between 00:00 and 05:30, and
// `new Date("YYYY-MM-DD")` parses as UTC midnight. Pure and import-free so
// `npm test` can run it.

export type MonthYear = { month: number; year: number };
export type DateRange = { date_from: string; date_to: string };
export type RangeKind = "this_month" | "last_month" | "last_3_months" | "custom";

// The backend rejects budget years outside this window (budget_entries_year_check).
export const MIN_YEAR = 2020;
export const MAX_YEAR = 2100;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar date of `d` as "YYYY-MM-DD". */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayLocal(now: Date = new Date()): string {
  return toYmd(now);
}

/** "YYYY-MM-DD" -> local Date at midnight, or null if it is not a real calendar date. */
export function parseDateOnly(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : null; // rejects 2026-02-31, month 13, year 0099, ...
}

/** Moves a month by `delta`, rolling over the year and clamping to the years the backend accepts. */
export function monthShift(month: number, year: number, delta: number): MonthYear {
  const index = year * 12 + (month - 1) + delta;
  if (index < MIN_YEAR * 12) return { month: 1, year: MIN_YEAR };
  if (index >= (MAX_YEAR + 1) * 12) return { month: 12, year: MAX_YEAR };
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

export function monthKey(month: number, year: number): string {
  return `${year}-${pad2(month)}`;
}

/** "YYYY-MM-DD" shifted by whole days (local calendar arithmetic). */
export function shiftDays(ymd: string, days: number): string {
  const date = parseDateOnly(ymd);
  if (!date) return ymd;
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

/** "Today" / "Yesterday" for those two days, otherwise null (the caller formats the date). */
export function relativeDayLabel(ymd: string, today: string): "Today" | "Yesterday" | null {
  if (ymd === today) return "Today";
  if (ymd === shiftDays(today, -1)) return "Yesterday";
  return null;
}

function monthBounds(month: number, year: number): DateRange {
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this one
  return { date_from: `${year}-${pad2(month)}-01`, date_to: `${year}-${pad2(month)}-${pad2(lastDay)}` };
}

/**
 * Explicit, inclusive date_from/date_to for a preset (the backend compares
 * with >= and <=, and its own period helpers use the server's UTC clock, so the
 * app always sends dates computed on the phone). "Last 3 months" is the current
 * calendar month plus the two before it.
 */
export function rangeFor(kind: Exclude<RangeKind, "custom">, now: Date = new Date()): DateRange {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (kind === "this_month") return monthBounds(month, year);
  if (kind === "last_month") {
    const last = monthShift(month, year, -1);
    return monthBounds(last.month, last.year);
  }
  const start = monthShift(month, year, -2);
  return { date_from: monthBounds(start.month, start.year).date_from, date_to: monthBounds(month, year).date_to };
}

/** True when a custom range is usable: both real dates and from <= to. */
export function isValidRange(range: DateRange): boolean {
  return parseDateOnly(range.date_from) !== null && parseDateOnly(range.date_to) !== null && range.date_from <= range.date_to;
}

/** True when `ymd` is more than a year before `today` (a likely typo worth a hint). */
export function isOverAYearAgo(ymd: string, today: string): boolean {
  const date = parseDateOnly(ymd);
  const now = parseDateOnly(today);
  if (!date || !now) return false;
  now.setFullYear(now.getFullYear() - 1);
  return date < now;
}
