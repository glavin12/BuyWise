// Calendar-date helpers. The API's transaction_date is a calendar DATE
// ("YYYY-MM-DD"), so everything here works in the device's LOCAL calendar and
// never round-trips through UTC: `toISOString().slice(0, 10)` is the UTC date,
// which is yesterday for a user in India between 00:00 and 05:30, and
// `new Date("YYYY-MM-DD")` parses as UTC midnight. Pure and import-free so
// `npm test` can run it.

export type MonthYear = { month: number; year: number };
export type DateRange = { date_from: string; date_to: string };

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

/** The device-local calendar month right now. */
export function currentMonth(now: Date = new Date()): MonthYear {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/** Route params ("8", "2026") -> a month the backend accepts, or null: a URL is untrusted text. */
export function parseMonthYear(month: unknown, year: unknown): MonthYear | null {
  if (typeof month !== "string" || typeof year !== "string") return null;
  if (!/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const parsed = { month: Number(month), year: Number(year) };
  const valid = parsed.month >= 1 && parsed.month <= 12 && parsed.year >= MIN_YEAR && parsed.year <= MAX_YEAR;
  return valid ? parsed : null;
}

/** "YYYY-MM-DD" shifted by whole days (local calendar arithmetic). */
export function shiftDays(ymd: string, days: number): string {
  const date = parseDateOnly(ymd);
  if (!date) return ymd;
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

/** Whole calendar days from `today` to `target` (negative once passed); null when either is not a real date. */
export function daysUntil(target: string, today: string): number | null {
  const to = parseDateOnly(target);
  const from = parseDateOnly(today);
  if (!to || !from) return null;
  // Both are local midnights; rounding absorbs the 23h/25h days around daylight-saving changes.
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** "Today" / "Yesterday" for those two days, otherwise null (the caller formats the date). */
export function relativeDayLabel(ymd: string, today: string): "Today" | "Yesterday" | null {
  if (ymd === today) return "Today";
  if (ymd === shiftDays(today, -1)) return "Yesterday";
  return null;
}

/** A month's first and last day as explicit, inclusive dates (the backend compares with >= and <=). */
export function monthBounds(month: number, year: number): DateRange {
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this one
  return { date_from: `${year}-${pad2(month)}-01`, date_to: `${year}-${pad2(month)}-${pad2(lastDay)}` };
}

/**
 * "9:40 pm": when a row was logged (`created_at`), but only if that was on its own
 * calendar date. Transactions store a date, not a time, so a backdated entry shows none.
 */
export function loggedTime(createdAt: string | null, ymd: string): string | null {
  if (!createdAt) return null;
  const at = new Date(createdAt);
  if (isNaN(at.getTime()) || toYmd(at) !== ymd) return null;
  const hours = at.getHours();
  return `${hours % 12 || 12}:${pad2(at.getMinutes())} ${hours < 12 ? "am" : "pm"}`;
}

/** True when `ymd` is more than a year before `today` (a likely typo worth a hint). */
export function isOverAYearAgo(ymd: string, today: string): boolean {
  const date = parseDateOnly(ymd);
  const now = parseDateOnly(today);
  if (!date || !now) return false;
  now.setFullYear(now.getFullYear() - 1);
  return date < now;
}
